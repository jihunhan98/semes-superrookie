package com.semes.reqops.domain.requirement.service;

import com.semes.reqops.domain.project.entity.Membership;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.dto.RequirementDto.CreateRequest;
import com.semes.reqops.domain.requirement.dto.RequirementDto.DetailResponse;
import com.semes.reqops.domain.requirement.dto.RequirementDto.FindingResponse;
import com.semes.reqops.domain.requirement.dto.RequirementDto.SummaryResponse;
import com.semes.reqops.domain.requirement.entity.Requirement;
import com.semes.reqops.domain.requirement.entity.RequirementAiDraft;
import com.semes.reqops.domain.requirement.entity.RequirementFinding;
import com.semes.reqops.domain.requirement.repository.RequirementAiDraftRepository;
import com.semes.reqops.domain.requirement.repository.RequirementFindingRepository;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.user.entity.User;
import com.semes.reqops.domain.user.repository.UserRepository;
import com.semes.reqops.global.ai.AiAnalyzeDto;
import com.semes.reqops.global.ai.AiClient;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RequirementService {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final RequirementRepository requirementRepository;
    private final RequirementFindingRepository findingRepository;
    private final RequirementAiDraftRepository aiDraftRepository;
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
        String draft = aiDraftRepository.findFirstByRequirementIdOrderByIdDesc(requirementId)
                .map(RequirementAiDraft::getDraftContent)
                .orElse(r.getContent());

        String assigneeName = r.getAssigneeId() == null ? null
                : userRepository.findById(r.getAssigneeId()).map(User::getName).orElse(null);

        return new DetailResponse(
                r.getId(), r.getProjectId(), r.getReqKey(), r.getContent(),
                r.getRequesterDept(), r.getRequesterName(),
                r.getState().name(), r.getState().label(), r.getVersion(),
                r.getAssigneeId(), assigneeName,
                draft,
                findings.isEmpty() ? "unavailable" : "ok",
                findings,
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

    // ── 내부 구현 ────────────────────────────────────────────────

    /** AI 응답을 findings + draft 로 저장한다. */
    private void saveAiResult(Long requirementId, AiAnalyzeDto.Response ai, String originalContent) {
        if (ai.findings() != null) {
            ai.findings().forEach(f -> findingRepository.save(new RequirementFinding(
                    requirementId, f.findingType(), f.targetSpan(),
                    f.reason(), f.suggestion(), f.conflictReqKey())));
        }
        String draft = (ai.draftContent() == null || ai.draftContent().isBlank())
                ? originalContent : ai.draftContent();
        aiDraftRepository.save(new RequirementAiDraft(requirementId, draft));
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
