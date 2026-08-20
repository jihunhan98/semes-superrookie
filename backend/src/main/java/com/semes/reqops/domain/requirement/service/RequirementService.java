package com.semes.reqops.domain.requirement.service;

import com.semes.reqops.domain.project.entity.Membership;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.dto.RequirementDto.CompareResponse;
import com.semes.reqops.domain.requirement.dto.RequirementDto.ConfirmRequest;
import com.semes.reqops.domain.requirement.dto.RequirementDto.ConsensusRequest;
import com.semes.reqops.domain.requirement.dto.RequirementDto.ConsensusResponse;
import com.semes.reqops.domain.requirement.dto.RequirementDto.CreateRequest;
import com.semes.reqops.domain.requirement.dto.RequirementDto.DiffAnalyzeRequest;
import com.semes.reqops.domain.requirement.dto.RequirementDto.DetailResponse;
import com.semes.reqops.domain.requirement.dto.RequirementDto.DiffRow;
import com.semes.reqops.domain.requirement.dto.RequirementDto.FindingResponse;
import com.semes.reqops.domain.requirement.dto.RequirementDto.SummaryResponse;
import com.semes.reqops.domain.requirement.dto.RequirementDto.VersionResponse;
import com.semes.reqops.domain.requirement.entity.Requirement;
import com.semes.reqops.domain.requirement.entity.RequirementAiDraft;
import com.semes.reqops.domain.requirement.entity.RequirementConsensus;
import com.semes.reqops.domain.requirement.entity.RequirementFinding;
import com.semes.reqops.domain.requirement.entity.RequirementVersion;
import com.semes.reqops.domain.requirement.repository.RequirementAiDraftRepository;
import com.semes.reqops.domain.requirement.repository.RequirementConsensusRepository;
import com.semes.reqops.domain.requirement.repository.RequirementFindingRepository;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.requirement.repository.RequirementVersionRepository;
import com.semes.reqops.domain.user.entity.User;
import com.semes.reqops.domain.user.repository.UserRepository;
import com.semes.reqops.global.ai.AiAnalyzeDto;
import com.semes.reqops.global.ai.AiClient;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RequirementService {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /** 최초 확정 버전. 이후 수정은 patch 만 올린다(1.0.1, 1.0.2 …). */
    private static final String FIRST_VERSION = "1.0.0";

    private final RequirementRepository requirementRepository;
    private final RequirementFindingRepository findingRepository;
    private final RequirementAiDraftRepository aiDraftRepository;
    private final RequirementConsensusRepository consensusRepository;
    private final RequirementVersionRepository versionRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final AiClient aiClient;

    /**
     * 요구사항 최초 등록.
     *
     * <p>저장과 <b>AI 초기 검토를 같은 요청 안에서</b> 끝낸다. 그래서 프론트는 이 호출이
     * 끝날 때까지 로딩을 보여주고, 응답이 오면 AI 참고 의견까지 이미 준비된 상태가 된다.
     * AI가 죽어 있으면 검출 0건으로 진행된다({@link AiClient} 참고) — 등록 자체는 막지 않는다.
     */
    @Transactional
    public DetailResponse create(Long projectId, CreateRequest req) {
        requireMember(projectId, req.userId());

        if (requirementRepository.existsByProjectIdAndReqKey(projectId, req.reqKey())) {
            throw new ApiErrors.DuplicateReqKey(req.reqKey());
        }

        Requirement requirement = new Requirement(
                projectId, req.reqKey(), req.content(),
                req.requesterDept(), req.requesterName(), req.userId());
        requirementRepository.save(requirement);

        AiAnalyzeDto.Response ai = aiClient.analyzeFull(req.content(), existingOf(projectId, requirement.getId()));
        saveAiResult(requirement.getId(), ai, req.content());

        return detail(projectId, requirement.getId(), req.userId());
    }

    /** 프로젝트의 요구사항 목록. 화면 1의 플랫 리스트. */
    @Transactional(readOnly = true)
    public List<SummaryResponse> list(Long projectId, Long userId) {
        requireMember(projectId, userId);

        List<Requirement> requirements = requirementRepository.findByProjectIdOrderByCreatedAtDesc(projectId);
        Map<Long, String> names = userNames(requirements.stream().map(Requirement::getAssigneeId).toList());

        return requirements.stream()
                .map(r -> new SummaryResponse(
                        r.getId(),
                        r.getReqKey(),
                        r.getContent(),
                        r.getState().name(),
                        r.getState().label(),
                        r.getVersion(),
                        r.getAssigneeId(),
                        names.get(r.getAssigneeId()),
                        findingRepository.countByRequirementId(r.getId()),
                        r.getUpdatedAt() == null ? null : r.getUpdatedAt().format(TS)))
                .toList();
    }

    /** 요구사항 상세 — AI 검토 결과와 draft 를 함께 내려준다. */
    @Transactional(readOnly = true)
    public DetailResponse detail(Long projectId, Long requirementId, Long userId) {
        requireMember(projectId, userId);
        Requirement r = findInProject(projectId, requirementId);

        List<FindingResponse> findings = findingRepository.findByRequirementIdOrderByIdAsc(requirementId).stream()
                .map(f -> new FindingResponse(
                        f.getFindingType(), f.getTargetSpan(), f.getReason(),
                        f.getSuggestion(), f.getConflictReqKey()))
                .toList();

        // draft 가 없으면(=AI 미가동으로 저장 안 됨) 원문을 그대로 쓴다.
        RequirementAiDraft aiDraft = aiDraftRepository
                .findFirstByRequirementIdOrderByIdDesc(requirementId).orElse(null);
        String draft = aiDraft == null ? r.getContent() : aiDraft.getDraftContent();
        String engine = aiDraft == null ? "unavailable" : aiDraft.getEngine();

        String assigneeName = r.getAssigneeId() == null ? null
                : userRepository.findById(r.getAssigneeId()).map(User::getName).orElse(null);

        ConsensusResponse consensus = consensusRepository
                .findFirstByRequirementIdOrderByIdDesc(requirementId)
                .map(this::toConsensusResponse)
                .orElse(null);

        RequirementVersion lastVersion = versionRepository
                .findFirstByRequirementIdOrderByIdDesc(requirementId).orElse(null);

        List<VersionResponse> versions = toVersionResponses(
                versionRepository.findByRequirementIdOrderByIdDesc(requirementId));

        // 확정 가능 조건: 아직 확정에 쓰이지 않은 합의 기록이 있을 것.
        // "확정 전"이 아니라 "미사용 합의"를 기준으로 삼는 이유 — 확정본 수정은 이미
        // 확정된 요구사항을 다시 확정하므로, 확정 여부로 막으면 수정 확정이 불가능해진다.
        boolean canConfirm = consensus != null && isUnusedConsensus(consensus.id(), lastVersion);

        return new DetailResponse(
                r.getId(), r.getProjectId(), r.getReqKey(), r.getContent(),
                r.getRequesterDept(), r.getRequesterName(),
                r.getState().name(), r.getState().label(), r.getVersion(),
                r.getAssigneeId(), assigneeName,
                draft,
                engine,
                findings,
                consensus,
                canConfirm,
                nextVersionOf(requirementId),
                versions,
                r.getCreatedAt() == null ? null : r.getCreatedAt().format(TS),
                r.getUpdatedAt() == null ? null : r.getUpdatedAt().format(TS));
    }

    /** AI 재분석 — 화면의 "↻ 다시 분석". 기존 검출을 지우고 다시 저장한다. */
    @Transactional
    public DetailResponse reanalyze(Long projectId, Long requirementId, Long userId) {
        requireMember(projectId, userId);
        Requirement r = findInProject(projectId, requirementId);

        findingRepository.deleteByRequirementId(requirementId);
        aiDraftRepository.deleteAll(aiDraftRepository.findByRequirementId(requirementId));

        AiAnalyzeDto.Response ai = aiClient.analyzeFull(r.getContent(), existingOf(projectId, requirementId));
        saveAiResult(requirementId, ai, r.getContent());

        return detail(projectId, requirementId, userId);
    }

    /**
     * 확정본 수정 시 AI 검토 — 확정본 대비 <b>바뀐 부분과 사유만</b> 본다.
     *
     * <p>최초 확정(본문 전체)과 달리, 이미 고객과 합의된 나머지 문장은 다시 건드리지
     * 않는다. 결과는 재분석과 마찬가지로 기존 검출을 지우고 새로 저장한다 — 화면이
     * 언제나 "가장 최근 검토 결과"만 보여주도록.
     *
     * <p>본문 자체는 아직 저장하지 않는다. 확정 단계에서 최종 문장을 받아 반영한다.
     */
    @Transactional
    public DetailResponse diffAnalyze(Long projectId, Long requirementId, DiffAnalyzeRequest req) {
        requireMember(projectId, req.userId());
        Requirement r = findInProject(projectId, requirementId);

        findingRepository.deleteByRequirementId(requirementId);
        aiDraftRepository.deleteAll(aiDraftRepository.findByRequirementId(requirementId));

        AiAnalyzeDto.Response ai = aiClient.analyzeDiff(
                req.content(), r.getContent(), req.reason(), existingOf(projectId, requirementId));
        saveAiResult(requirementId, ai, req.content());

        // 목록에서 "지금 손대는 중"으로 보이게 한다. 버전은 재확정 전까지 그대로.
        r.startRevision();
        requirementRepository.save(r);

        return detail(projectId, requirementId, req.userId());
    }

    /**
     * 고객 합의 기록 — 확정의 전제 조건.
     *
     * <p>AI 의견이 합리적이어도 그것만으로는 확정할 수 없다. 이 기록이 남아야 확정
     * 버튼이 열린다. 합의할 때마다 새 행을 쌓고, 확정은 항상 마지막 행을 근거로 삼는다.
     */
    @Transactional
    public DetailResponse recordConsensus(Long projectId, Long requirementId, ConsensusRequest req) {
        requireMember(projectId, req.userId());
        Requirement r = findInProject(projectId, requirementId);

        consensusRepository.save(new RequirementConsensus(
                requirementId, req.method().trim(), req.customerContact().trim(),
                parseDate(req.agreedOn()), blankToNull(req.note()),
                req.agreedContent(), req.userId()));

        // 합의까지 끝났으니 "고객 합의 대기"로 올린다. 확정은 아직 별도 단계.
        r.markPendingConsensus();
        requirementRepository.save(r);

        return detail(projectId, requirementId, req.userId());
    }

    /**
     * 확정 — 합의된 본문을 확정본으로 삼고 버전을 부여한다. 최초 확정과 재확정 공통.
     *
     * <p>아직 확정에 쓰이지 않은 합의 기록이 없으면 거부한다. 화면에서도 버튼이
     * 비활성화되지만, API 단에서도 막아야 "합의 없이 확정된 요구사항"이 만들어지지 않는다.
     */
    @Transactional
    public DetailResponse confirm(Long projectId, Long requirementId, ConfirmRequest req) {
        requireMember(projectId, req.userId());
        Requirement r = findInProject(projectId, requirementId);

        RequirementConsensus consensus = consensusRepository
                .findFirstByRequirementIdOrderByIdDesc(requirementId)
                .orElseThrow(ApiErrors.ConsensusRequired::new);

        RequirementVersion lastVersion = versionRepository
                .findFirstByRequirementIdOrderByIdDesc(requirementId).orElse(null);
        // 같은 합의로 두 번 확정하면 두 번째 버전은 근거 없이 올라간 셈이 된다.
        if (!isUnusedConsensus(consensus.getId(), lastVersion)) {
            throw new ApiErrors.ConsensusRequired();
        }

        String version = nextVersionOf(requirementId);
        // 최초 확정은 바꿀 원본이 없어 사유를 받지 않는다 — 이력 제목을 서버가 넣는다.
        // 확정본 수정은 화면에서 받은 변경 사유가 그대로 이력 제목이 된다.
        String title = blankToNull(req.title()) == null ? "최초 확정" : req.title().trim();

        r.confirm(req.content(), version);
        requirementRepository.save(r);

        versionRepository.save(new RequirementVersion(
                requirementId, version, title, req.content(), consensus.getId(), req.userId()));

        return detail(projectId, requirementId, req.userId());
    }

    /**
     * 두 버전 비교 — 화면 6의 split diff.
     *
     * <p>base/head 를 생략하면 "직전 버전 ↔ 최신 버전"을 기본으로 본다. 확정이 한 번
     * 뿐이면 비교할 이전 버전이 없으므로 base 를 빈 문자열로 두고 전부 추가로 보여준다.
     */
    @Transactional(readOnly = true)
    public CompareResponse compare(Long projectId, Long requirementId, Long userId,
                                   String baseVersion, String headVersion) {
        requireMember(projectId, userId);
        findInProject(projectId, requirementId);

        // 오래된 것부터 — 기본값(직전 ↔ 최신)을 고르기 쉽게.
        List<RequirementVersion> all = new ArrayList<>(
                versionRepository.findByRequirementIdOrderByIdDesc(requirementId));
        Collections.reverse(all);

        if (all.isEmpty()) {
            throw new ApiErrors.VersionNotFound("확정 이력이 없습니다");
        }

        RequirementVersion head = pickVersion(all, headVersion, all.get(all.size() - 1));
        RequirementVersion base = baseVersion == null || baseVersion.isBlank()
                ? previousOf(all, head)
                : pickVersion(all, baseVersion, null);

        String baseText = base == null ? "" : base.getContent();
        List<DiffRow> rows = LineDiff.rows(baseText, head.getContent());

        int added = (int) rows.stream().filter(r -> r.headText() != null && !"ctx".equals(r.type())).count();
        int removed = (int) rows.stream().filter(r -> r.baseText() != null && !"ctx".equals(r.type())).count();

        return new CompareResponse(
                base == null ? null : base.getVersion(),
                head.getVersion(),
                head.getTitle(),
                userName(head.getConfirmedBy()),
                head.getCreatedAt() == null ? null : head.getCreatedAt().format(TS),
                added, removed, rows);
    }

    /** 보류 — 고객 협의가 더 필요할 때. 나중에 이어서 확정할 수 있다. */
    @Transactional
    public DetailResponse hold(Long projectId, Long requirementId, Long userId) {
        requireMember(projectId, userId);
        Requirement r = findInProject(projectId, requirementId);
        r.hold();
        requirementRepository.save(r);
        return detail(projectId, requirementId, userId);
    }

    // ── 내부 구현 ────────────────────────────────────────────────

    /**
     * 이 합의 기록이 아직 확정에 쓰이지 않았는지.
     *
     * <p>확정 한 번은 합의 한 건을 "소비"한다. 같은 합의로 두 번 확정하면 두 번째
     * 버전은 근거 없이 올라간 셈이 되므로, 마지막 버전이 근거로 삼은 합의보다 뒤에
     * 기록된 합의가 있을 때만 확정을 연다.
     */
    private boolean isUnusedConsensus(Long consensusId, RequirementVersion lastVersion) {
        if (lastVersion == null) {
            return true;   // 아직 확정한 적이 없다 — 최초 확정
        }
        Long used = lastVersion.getConsensusId();
        return used == null || consensusId > used;
    }

    /**
     * 버전 이력 응답 — 각 줄에 MAJOR/MINOR/PATCH 를 붙인다.
     *
     * <p>이력은 최신순으로 들어오므로, 바로 다음 원소(=한 단계 이전 버전)와 비교한다.
     */
    private List<VersionResponse> toVersionResponses(List<RequirementVersion> newestFirst) {
        List<VersionResponse> out = new ArrayList<>();
        for (int i = 0; i < newestFirst.size(); i++) {
            RequirementVersion v = newestFirst.get(i);
            RequirementVersion prev = i + 1 < newestFirst.size() ? newestFirst.get(i + 1) : null;
            out.add(new VersionResponse(
                    v.getId(), v.getVersion(), v.getTitle(), v.getContent(),
                    kindOf(prev == null ? null : prev.getVersion(), v.getVersion()),
                    userName(v.getConfirmedBy()),
                    v.getCreatedAt() == null ? null : v.getCreatedAt().format(TS)));
        }
        return out;
    }

    /**
     * 두 버전을 비교해 어느 자리가 올랐는지 판정한다.
     *
     * <p>첫 확정(이전 버전 없음)은 MINOR 로 본다 — 문구를 다듬은 게 아니라 해석을
     * 처음 확정한 것이기 때문.
     */
    private String kindOf(String prev, String cur) {
        if (prev == null) {
            return "MINOR";
        }
        String[] p = prev.split("\\.");
        String[] c = cur.split("\\.");
        if (p.length != 3 || c.length != 3) {
            return "PATCH";
        }
        if (!p[0].equals(c[0])) {
            return "MAJOR";
        }
        if (!p[1].equals(c[1])) {
            return "MINOR";
        }
        return "PATCH";
    }

    /** 이력에서 특정 버전을 찾는다. 없으면 fallback, fallback 도 없으면 404. */
    private RequirementVersion pickVersion(List<RequirementVersion> all, String version,
                                           RequirementVersion fallback) {
        if (version != null && !version.isBlank()) {
            for (RequirementVersion v : all) {
                if (v.getVersion().equals(version.trim())) {
                    return v;
                }
            }
            if (fallback == null) {
                throw new ApiErrors.VersionNotFound(version);
            }
        }
        if (fallback == null) {
            throw new ApiErrors.VersionNotFound(version);
        }
        return fallback;
    }

    /** 이력에서 head 바로 앞 버전. head 가 첫 버전이면 null. */
    private RequirementVersion previousOf(List<RequirementVersion> oldestFirst, RequirementVersion head) {
        int idx = oldestFirst.indexOf(head);
        return idx > 0 ? oldestFirst.get(idx - 1) : null;
    }

    private ConsensusResponse toConsensusResponse(RequirementConsensus c) {
        return new ConsensusResponse(
                c.getId(), c.getMethod(), c.getCustomerContact(),
                c.getAgreedOn() == null ? null : c.getAgreedOn().format(D),
                c.getNote(), c.getAgreedContent(),
                userName(c.getRecordedBy()),
                c.getCreatedAt() == null ? null : c.getCreatedAt().format(TS));
    }

    /**
     * 다음에 부여될 버전.
     *
     * <p>확정 이력이 없으면 1.0.0, 있으면 patch 를 하나 올린다. 지금은 확정본 수정이
     * 아직 없어 실질적으로 항상 1.0.0 이지만, 화면이 "확정 시 v?" 를 미리 보여줘야 해서
     * 조회 시점에도 계산해 내려준다.
     */
    private String nextVersionOf(Long requirementId) {
        return versionRepository.findFirstByRequirementIdOrderByIdDesc(requirementId)
                .map(v -> bumpPatch(v.getVersion()))
                .orElse(FIRST_VERSION);
    }

    private String bumpPatch(String version) {
        String[] parts = version.split("\\.");
        if (parts.length != 3) {
            return FIRST_VERSION;
        }
        try {
            return parts[0] + "." + parts[1] + "." + (Integer.parseInt(parts[2]) + 1);
        } catch (NumberFormatException e) {
            return FIRST_VERSION;
        }
    }

    private LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value.trim(), D);
        } catch (DateTimeParseException e) {
            throw new ApiErrors.InvalidAgreedDate(value);
        }
    }

    private String userName(Long userId) {
        return userId == null ? null
                : userRepository.findById(userId).map(User::getName).orElse(null);
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    /** AI 응답을 findings + draft 로 저장한다. */
    private void saveAiResult(Long requirementId, AiAnalyzeDto.Response ai, String originalContent) {
        if (ai.findings() != null) {
            ai.findings().forEach(f -> findingRepository.save(new RequirementFinding(
                    requirementId, f.findingType(), f.targetSpan(),
                    f.reason(), f.suggestion(), f.conflictReqKey())));
        }
        String draft = (ai.draftContent() == null || ai.draftContent().isBlank())
                ? originalContent : ai.draftContent();
        String engine = (ai.engine() == null || ai.engine().isBlank()) ? "unavailable" : ai.engine();
        aiDraftRepository.save(new RequirementAiDraft(requirementId, draft, engine));
    }

    /** 상충 검출에 쓸 같은 프로젝트의 다른 요구사항들. */
    private List<AiAnalyzeDto.Existing> existingOf(Long projectId, Long excludeId) {
        return requirementRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .filter(r -> !r.getId().equals(excludeId))
                .map(r -> new AiAnalyzeDto.Existing(r.getReqKey(), r.getContent()))
                .toList();
    }

    private Requirement findInProject(Long projectId, Long requirementId) {
        Requirement r = requirementRepository.findById(requirementId)
                .orElseThrow(() -> new ApiErrors.RequirementNotFound(requirementId));
        if (!r.getProjectId().equals(projectId)) {
            throw new ApiErrors.RequirementNotFound(requirementId);
        }
        return r;
    }

    private void requireMember(Long projectId, Long userId) {
        membershipRepository.findByUserIdAndProjectId(userId, projectId)
                .orElseThrow(ApiErrors.NotProjectMember::new);
    }

    /** 담당자 id → 이름. 목록에서 사용자마다 조회하지 않도록 한 번에 모아 온다. */
    private Map<Long, String> userNames(List<Long> userIds) {
        List<Long> ids = userIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) return Map.of();
        return userRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(User::getId, User::getName));
    }

    /** 담당자 필터 후보 — 프로젝트 멤버 전원(화면 1의 이름 칩). */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> assigneeCandidates(Long projectId, Long userId) {
        requireMember(projectId, userId);
        return membershipRepository.findByProjectId(projectId).stream()
                .map(Membership::getUserId)
                .map(id -> userRepository.findById(id).orElse(null))
                .filter(java.util.Objects::nonNull)
                .map(u -> Map.<String, Object>of("userId", u.getId(), "name", u.getName()))
                .toList();
    }
}
