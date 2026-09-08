package com.semes.reqops.domain.issue.service;

import com.semes.reqops.domain.issue.dto.IssueDto.ConfirmSplitRequest;
import com.semes.reqops.domain.issue.dto.IssueDto.IssueCandidate;
import com.semes.reqops.domain.issue.dto.IssueDto.IssueInput;
import com.semes.reqops.domain.issue.dto.IssueDto.IssueResponse;
import com.semes.reqops.domain.issue.dto.IssueDto.SplitPreviewRequest;
import com.semes.reqops.domain.issue.dto.IssueDto.SplitPreviewResponse;
import com.semes.reqops.domain.issue.entity.DevIssue;
import com.semes.reqops.domain.issue.repository.DevIssueRepository;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.entity.ReqState;
import com.semes.reqops.domain.requirement.entity.Requirement;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.user.entity.User;
import com.semes.reqops.domain.user.repository.UserRepository;
import com.semes.reqops.global.ai.AiClient;
import com.semes.reqops.global.ai.AiSplitDto;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * "이슈 나누기" — 확정 요구사항 1건을 개발 이슈 N건으로 나눈다(1:N).
 *
 * <p>산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design)은 아직 화면 얼개(목업)만
 * 있고 이 서비스가 만들지 않는다 — {@code frontend/app/lib/artifactsMock.ts} 가
 * 이 서비스가 내려준 실제 이슈(키·제목)에 목업 내용을 입혀 보여준다.
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

    /** 화면이 열릴 때·"AI 다시 나눠줘"를 눌렀을 때 — 아무것도 저장하지 않는다. */
    @Transactional(readOnly = true)
    public SplitPreviewResponse preview(Long projectId, Long requirementId, SplitPreviewRequest req) {
        requireMember(projectId, req.userId());
        Requirement r = findConfirmed(projectId, requirementId);

        AiSplitDto.Response ai = aiClient.splitIssues(r.getContent(), blankToNull(req.reason()));
        List<IssueCandidate> issues = (ai.issues() == null ? List.<AiSplitDto.IssueOut>of() : ai.issues()).stream()
                .map(i -> new IssueCandidate(i.title(), i.quote()))
                .toList();

        return new SplitPreviewResponse(issues, ai.engine());
    }

    /**
     * 분할 확정 — 이 요구사항의 기존 이슈를 전부 지우고 사람이 최종 확정한 목록으로
     * 새로 쌓는다(재분할은 이력을 남기지 않는다 — {@link DevIssue} 설명 참고).
     */
    @Transactional
    public List<IssueResponse> confirmSplit(Long projectId, Long requirementId, ConfirmSplitRequest req) {
        requireMember(projectId, req.userId());
        findConfirmed(projectId, requirementId);

        devIssueRepository.deleteByRequirementId(requirementId);

        String reqKey = requirementRepository.findById(requirementId)
                .orElseThrow(() -> new ApiErrors.RequirementNotFound(requirementId))
                .getReqKey();

        List<IssueInput> inputs = req.issues();
        for (int i = 0; i < inputs.size(); i++) {
            IssueInput in = inputs.get(i);
            devIssueRepository.save(new DevIssue(
                    requirementId,
                    reqKey + "-" + (i + 1),
                    in.title().trim(),
                    blankToNull(in.quote()),
                    i,
                    req.userId()));
        }

        return list(projectId, requirementId, req.userId());
    }

    /** 이미 나눠 놓은 이슈 목록 — 산출물 트리 화면이 이걸로 실제 이슈를 그린다. */
    @Transactional(readOnly = true)
    public List<IssueResponse> list(Long projectId, Long requirementId, Long userId) {
        requireMember(projectId, userId);
        findInProject(projectId, requirementId);

        return devIssueRepository.findByRequirementIdOrderByDisplayOrderAsc(requirementId).stream()
                .map(this::toResponse)
                .toList();
    }

    // ── 내부 구현 ────────────────────────────────────────────────

    private IssueResponse toResponse(DevIssue issue) {
        String createdByName = userRepository.findById(issue.getCreatedBy()).map(User::getName).orElse(null);
        return new IssueResponse(
                issue.getId(), issue.getIssueKey(), issue.getTitle(), issue.getQuote(),
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
}
