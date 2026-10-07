package com.semes.reqops.domain.issue.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.issue.dto.IssueDto.ConfirmSplitRequest;
import com.semes.reqops.domain.issue.dto.IssueDto.IssueCandidate;
import com.semes.reqops.domain.issue.dto.IssueDto.IssueInput;
import com.semes.reqops.domain.issue.dto.IssueDto.IssueResponse;
import com.semes.reqops.domain.issue.dto.IssueDto.SplitPreviewRequest;
import com.semes.reqops.domain.issue.dto.IssueDto.SplitPreviewResponse;
import com.semes.reqops.domain.issue.dto.IssueDto.UpdateRequest;
import com.semes.reqops.domain.issue.entity.DevIssue;
import com.semes.reqops.domain.issue.entity.IssueLineage;
import com.semes.reqops.domain.issue.entity.IssueRevision;
import com.semes.reqops.domain.issue.repository.DevIssueRepository;
import com.semes.reqops.domain.issue.repository.IssueLineageRepository;
import com.semes.reqops.domain.issue.repository.IssueRevisionRepository;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.entity.ReqState;
import com.semes.reqops.domain.requirement.entity.Requirement;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.user.entity.User;
import com.semes.reqops.domain.user.repository.UserRepository;
import com.semes.reqops.global.ai.AiClient;
import com.semes.reqops.global.ai.AiSplitDto;
import com.semes.reqops.global.exception.ApiErrors;
import com.semes.reqops.domain.workflow.entity.WorkBundle;
import com.semes.reqops.domain.workflow.repository.WorkBundleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * "이슈 나누기" — 확정 요구사항 1건을 개발 이슈 N건으로 나눈다(1:N).
 *
 * <p>산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design)은 아직 화면 얼개(목업)만
 * 산출물은 canonical {@code DEV_ISSUE_ARTIFACTS}에 고정 schema v2로 저장한다.
 */
@Service
@RequiredArgsConstructor
public class DevIssueService {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final DevIssueRepository devIssueRepository;
    private final RequirementRepository requirementRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final AiClient aiClient;
    private final WorkBundleRepository bundleRepository;
    private final IssueRevisionRepository revisionRepository;
    private final IssueLineageRepository lineageRepository;
    private final ObjectMapper objectMapper;

    /** 화면이 열릴 때·"AI 다시 나눠줘"를 눌렀을 때 — 아무것도 저장하지 않는다. */
    @Transactional(readOnly = true)
    public SplitPreviewResponse preview(Long projectId, Long requirementId, SplitPreviewRequest req) {
        requireMember(projectId, req.userId());
        Requirement r = findConfirmed(projectId, requirementId);

        AiSplitDto.Response ai = aiClient.splitIssues(r.getContent(), blankToNull(req.reason()),
                requirementRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                        .filter(other -> !other.getId().equals(requirementId))
                        .map(other -> new com.semes.reqops.global.ai.AiAnalyzeDto.Existing(other.getReqKey(), other.getContent()))
                        .toList());
        List<IssueCandidate> issues = (ai.issues() == null ? List.<AiSplitDto.IssueOut>of() : ai.issues()).stream()
                .map(i -> new IssueCandidate(i.title(), i.quote()))
                .toList();

        return new SplitPreviewResponse(issues, ai.engine());
    }

    /**
     * 분할 확정 — 이 요구사항의 기존 이슈를 전부 지우고 사람이 최종 확정한 목록으로
     * 새로 쌓는다. 기존 이슈는 보존하고 revision과 split/merge lineage를 기록한다.
     */
    @Transactional
    public List<IssueResponse> confirmSplit(Long projectId, Long requirementId, ConfirmSplitRequest req) {
        requireMember(projectId, req.userId());
        Requirement requirement = findConfirmed(projectId, requirementId);

        List<String> normalizedQuotes = req.issues().stream().map(IssueInput::quote)
                .map(String::trim).toList();
        if (normalizedQuotes.stream().anyMatch(quote -> !requirement.getContent().contains(quote))) {
            throw new ApiErrors.BadRequest("개발 이슈의 근거 구절은 확정 요구사항 본문에 그대로 존재해야 합니다.");
        }
        if (normalizedQuotes.stream().distinct().count() != normalizedQuotes.size()) {
            throw new ApiErrors.BadRequest("같은 요구사항 구절을 여러 개발 이슈에 중복 연결할 수 없습니다.");
        }

        List<DevIssue> previous = devIssueRepository
                .findByRequirementIdAndIssueStateNotOrderByDisplayOrderAsc(requirementId, "RETIRED");
        // Reordering/title edits preserve the immutable database ID and existing links.
        List<IssueInput> inputs = req.issues();
        List<DevIssue> created = new ArrayList<>();
        List<IssueInput> newInputs=inputs.stream().filter(in->previous.stream().noneMatch(old->in.quote().trim().equals(old.getQuote()))).toList();
        List<Map<String,Object>> enriched=List.of();
        if(!newInputs.isEmpty()) {
            var response=aiClient.insight("/issues/enrich",Map.of("requirementContent",requirement.getContent(),
                "existing",requirementRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream().map(r->Map.of("reqKey",r.getReqKey(),"content",r.getContent())).toList(),
                "issues",newInputs.stream().map(in->Map.of("title",in.title().trim(),"quote",in.quote().trim())).toList()));
            enriched=objectMapper.convertValue(response.get("issues"),new com.fasterxml.jackson.core.type.TypeReference<List<Map<String,Object>>>(){});
        }
        for(int i=0;i<inputs.size();i++) {
            IssueInput in=inputs.get(i);
            DevIssue issue=previous.stream().filter(old->in.quote().trim().equals(old.getQuote())).findFirst().orElse(null);
            boolean isNew=issue==null;
            if(isNew)issue=new DevIssue(requirementId,"I-"+UUID.randomUUID().toString().substring(0,12),in.title().trim(),in.quote().trim(),i,req.userId());
            else saveRevision(issue,"수정 전 스냅샷",req.userId());
            Map<String,Object> aiBody=enriched.stream().filter(row->in.quote().trim().equals(row.get("quote"))).findFirst().orElse(Map.of());
            issue.reorder(i);
            issue.updateBody(in.title().trim(),in.quote().trim(),
                defaultText(in.symptom(),isNew?(String)aiBody.get("symptom"):issue.getSymptom()),
                defaultText(in.improvementReq(),isNew?(String)aiBody.get("improvementReq"):issue.getImprovementReq()),
                defaultText(in.changeScope(),isNew?(String)aiBody.get("changeScope"):issue.getChangeScope()),
                defaultText(in.constraintsNote(),isNew?(String)aiBody.get("constraintsNote"):issue.getConstraintsNote()),
                defaultText(in.beforeState(),isNew?(String)aiBody.get("beforeState"):issue.getBeforeState()),
                defaultText(in.afterState(),isNew?(String)aiBody.get("afterState"):issue.getAfterState()),in.dueOn()==null?issue.getDueOn():in.dueOn());
            var bundle=bundleRepository.findFirstByRequirementIdAndCurrentOrderByRevisionNoDesc(requirementId,1);
            if(bundle.isPresent())issue.assignBundle(bundle.get().getId());
            DevIssue saved=devIssueRepository.save(issue);saveRevision(saved,"분할 확정",req.userId());created.add(saved);
        }
        previous.stream().filter(old->created.stream().noneMatch(row->row.getId().equals(old.getId()))).forEach(old->{saveRevision(old,"재분할 전 스냅샷",req.userId());old.retire();devIssueRepository.save(old);});
        saveLineage(previous, created);

        bundleRepository.findFirstByRequirementIdAndCurrentOrderByRevisionNoDesc(requirementId, 1)
                .ifPresent(bundle -> { bundle.issuesReady(); bundleRepository.save(bundle); });

        return list(projectId, requirementId, req.userId());
    }

    /** 이미 나눠 놓은 이슈 목록 — 산출물 트리 화면이 이걸로 실제 이슈를 그린다. */
    @Transactional(readOnly = true)
    public List<IssueResponse> list(Long projectId, Long requirementId, Long userId) {
        requireMember(projectId, userId);
        findInProject(projectId, requirementId);

        return devIssueRepository.findByRequirementIdAndIssueStateNotOrderByDisplayOrderAsc(requirementId, "RETIRED").stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public IssueResponse update(Long projectId, Long requirementId, Long issueId, UpdateRequest req) {
        requireMember(projectId, req.userId());
        Requirement source=findInProject(projectId, requirementId);
        if(blankToNull(req.quote())==null || !source.getContent().contains(req.quote().trim()))throw new ApiErrors.BadRequest("개발 이슈의 근거 구절은 요구사항 원문에 있어야 합니다.");
        DevIssue issue = devIssueRepository.findById(issueId)
                .filter(row -> row.getRequirementId().equals(requirementId) && !"RETIRED".equals(row.getIssueState()))
                .orElseThrow(() -> new ApiErrors.DevIssueNotFound(String.valueOf(issueId)));
        issue.updateBody(req.title().trim(), blankToNull(req.quote()), blankToNull(req.symptom()),
                blankToNull(req.improvementReq()), blankToNull(req.changeScope()), blankToNull(req.constraintsNote()),
                blankToNull(req.beforeState()), blankToNull(req.afterState()), req.dueOn());
        if (req.confirmed()) issue.confirm();
        DevIssue saved = devIssueRepository.save(issue);
        saveRevision(saved, req.confirmed() ? "개발 이슈 확정" : "개발 이슈 수정", req.userId());
        return toResponse(saved);
    }

    // ── 내부 구현 ────────────────────────────────────────────────

    private IssueResponse toResponse(DevIssue issue) {
        String createdByName = userRepository.findById(issue.getCreatedBy()).map(User::getName).orElse(null);
        return new IssueResponse(
                issue.getId(), issue.getIssueKey(), issue.getTitle(), issue.getQuote(),
                issue.getSymptom(), issue.getImprovementReq(), issue.getChangeScope(), issue.getConstraintsNote(),
                issue.getBeforeState(), issue.getAfterState(), issue.getDueOn(),
                issue.getResolvedAt() == null ? null : issue.getResolvedAt().format(TS),
                issue.getIssueState(), issue.getRowVersion(),
                issue.getDisplayOrder(), createdByName,
                issue.getCreatedAt() == null ? null : issue.getCreatedAt().format(TS));
    }

    private Requirement findInProject(Long projectId, Long requirementId) {
        Requirement r = requirementRepository.findById(requirementId)
                .orElseThrow(() -> new ApiErrors.RequirementNotFound(requirementId));
        if (!r.getProjectId().equals(projectId)) {
            throw new ApiErrors.RequirementNotFound(requirementId);
        }
        return r;
    }

    /** 확정된 요구사항만 이슈로 나눌 수 있다 — 산출물 도출 목록 화면과 같은 기준(state==CONFIRMED). */
    private Requirement findConfirmed(Long projectId, Long requirementId) {
        Requirement r = findInProject(projectId, requirementId);
        if (r.getState() != ReqState.CONFIRMED) {
            throw new ApiErrors.RequirementNotConfirmed();
        }
        return r;
    }

    private void requireMember(Long projectId, Long userId) {
        membershipRepository.findByUserIdAndProjectId(userId, projectId)
                .orElseThrow(ApiErrors.NotProjectMember::new);
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    private String defaultText(String value, String fallback) {
        String normalized = blankToNull(value);
        return normalized == null ? blankToNull(fallback) : normalized;
    }

    private void saveRevision(DevIssue issue, String reason, Long actorId) {
        try {
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("issueKey", issue.getIssueKey()); snapshot.put("title", issue.getTitle());
            snapshot.put("quote", issue.getQuote()); snapshot.put("symptom", issue.getSymptom());
            snapshot.put("improvementReq", issue.getImprovementReq()); snapshot.put("changeScope", issue.getChangeScope());
            snapshot.put("constraintsNote", issue.getConstraintsNote()); snapshot.put("beforeState", issue.getBeforeState());
            snapshot.put("afterState", issue.getAfterState()); snapshot.put("dueOn", issue.getDueOn());
            snapshot.put("state", issue.getIssueState());
            String json = objectMapper.writeValueAsString(snapshot);
            revisionRepository.save(new IssueRevision(issue.getId(),
                    revisionRepository.countByIssueId(issue.getId()) + 1, json, sha256(json), reason, actorId));
        } catch (Exception e) {
            throw new IllegalStateException("개발 이슈 이력을 저장할 수 없습니다.", e);
        }
    }

    private void saveLineage(List<DevIssue> previous, List<DevIssue> created) {
        for (DevIssue source : previous) {
            List<DevIssue> targets = created.stream()
                    .filter(target -> overlaps(source.getQuote(), target.getQuote())).toList();
            for (DevIssue target : targets) {
                if(source.getId().equals(target.getId()))continue;
                long sourceCount = previous.stream().filter(old -> overlaps(old.getQuote(), target.getQuote())).count();
                String relation = targets.size() > 1 ? "SPLIT_TO" : sourceCount > 1 ? "MERGED_TO" : "REPLACED_BY";
                lineageRepository.save(new IssueLineage(source.getId(), target.getId(), relation));
            }
        }
    }

    private boolean overlaps(String left, String right) {
        if (left == null || right == null) return false;
        String a = left.trim(); String b = right.trim();
        return !a.isEmpty() && !b.isEmpty() && (a.contains(b) || b.contains(a));
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
