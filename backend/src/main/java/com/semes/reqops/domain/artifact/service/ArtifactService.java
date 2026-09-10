package com.semes.reqops.domain.artifact.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.artifact.dto.ArtifactDto.ArtifactResponse;
import com.semes.reqops.domain.artifact.dto.ArtifactDto.ConfirmRequest;
import com.semes.reqops.domain.artifact.dto.ArtifactDto.RegenerateRequest;
import com.semes.reqops.domain.artifact.entity.ArtifactType;
import com.semes.reqops.domain.artifact.entity.DevIssueArtifact;
import com.semes.reqops.domain.artifact.repository.DevIssueArtifactRepository;
import com.semes.reqops.domain.issue.entity.DevIssue;
import com.semes.reqops.domain.issue.repository.DevIssueRepository;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.entity.Requirement;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.global.ai.AiArtifactDto;
import com.semes.reqops.global.ai.AiClient;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.Map;

/**
 * 산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design) 상세 — 개발 이슈 1건당 1개씩.
 *
 * <p>처음 열람할 때 저장된 내용이 없으면 그 자리에서 AI 초안을 만들어 DRAFT로
 * 저장한다(화면이 빈 채로 뜨면 안 되므로 — "이슈 나누기"의 preview와 달리 산출물
 * 화면은 별도 진입 단계가 없어 조회 자체가 최초 생성을 겸한다). 이후 조회는 저장된
 * 값을 그대로 돌려주고, 재생성·확정으로만 바뀐다.
 */
@Service
@RequiredArgsConstructor
public class ArtifactService {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final DevIssueArtifactRepository artifactRepository;
    private final DevIssueRepository devIssueRepository;
    private final RequirementRepository requirementRepository;
    private final MembershipRepository membershipRepository;
    private final AiClient aiClient;
    private final ObjectMapper objectMapper;

    @Transactional
    public ArtifactResponse get(Long projectId, Long requirementId, String issueKey, String typeSlug, Long userId) {
        requireMember(projectId, userId);
        DevIssue issue = findIssue(projectId, requirementId, issueKey);
        ArtifactType type = ArtifactType.fromSlug(typeSlug);

        DevIssueArtifact artifact = artifactRepository.findByDevIssueIdAndArtifactType(issue.getId(), type)
                .orElseGet(() -> createDraft(issue, type, null, userId));
        return toResponse(type, artifact);
    }

    @Transactional
    public ArtifactResponse regenerate(Long projectId, Long requirementId, String issueKey, String typeSlug,
                                       RegenerateRequest req) {
        requireMember(projectId, req.userId());
        DevIssue issue = findIssue(projectId, requirementId, issueKey);
        ArtifactType type = ArtifactType.fromSlug(typeSlug);
        String reason = blankToNull(req.reason());

        DevIssueArtifact artifact = artifactRepository.findByDevIssueIdAndArtifactType(issue.getId(), type)
                .orElseGet(() -> createDraft(issue, type, reason, req.userId()));

        String content = requirementRepository.findById(requirementId)
                .orElseThrow(() -> new ApiErrors.RequirementNotFound(requirementId))
                .getContent();
        AiArtifactDto.Response ai = aiClient.generateArtifact(
                type.slug(), issue.getTitle(), issue.getQuote(), content, reason);
        artifact.regenerate(writeJson(ai.content()), ai.engine());
        return toResponse(type, artifact);
    }

    @Transactional
    public ArtifactResponse confirm(Long projectId, Long requirementId, String issueKey, String typeSlug,
                                    ConfirmRequest req) {
        requireMember(projectId, req.userId());
        DevIssue issue = findIssue(projectId, requirementId, issueKey);
        ArtifactType type = ArtifactType.fromSlug(typeSlug);

        DevIssueArtifact artifact = artifactRepository.findByDevIssueIdAndArtifactType(issue.getId(), type)
                .orElseGet(() -> createDraft(issue, type, null, req.userId()));
        artifact.confirm(writeJson(req.content()), req.userId());
        return toResponse(type, artifact);
    }

    // ── 내부 구현 ────────────────────────────────────────────────

    private DevIssueArtifact createDraft(DevIssue issue, ArtifactType type, String reason, Long userId) {
        Requirement r = requirementRepository.findById(issue.getRequirementId())
                .orElseThrow(() -> new ApiErrors.RequirementNotFound(issue.getRequirementId()));
        AiArtifactDto.Response ai = aiClient.generateArtifact(
                type.slug(), issue.getTitle(), issue.getQuote(), r.getContent(), reason);
        return artifactRepository.save(
                new DevIssueArtifact(issue.getId(), type, writeJson(ai.content()), ai.engine(), userId));
    }

    private ArtifactResponse toResponse(ArtifactType type, DevIssueArtifact artifact) {
        return new ArtifactResponse(
                type.slug(),
                artifact.getState().name(),
                readJson(artifact.getContentJson()),
                artifact.getEngine(),
                artifact.getUpdatedAt() == null ? null : artifact.getUpdatedAt().format(TS));
    }

    private DevIssue findIssue(Long projectId, Long requirementId, String issueKey) {
        Requirement r = requirementRepository.findById(requirementId)
                .orElseThrow(() -> new ApiErrors.RequirementNotFound(requirementId));
        if (!r.getProjectId().equals(projectId)) {
            throw new ApiErrors.RequirementNotFound(requirementId);
        }
        return devIssueRepository.findByRequirementIdAndIssueKey(requirementId, issueKey)
                .orElseThrow(() -> new ApiErrors.DevIssueNotFound(issueKey));
    }

    private void requireMember(Long projectId, Long userId) {
        membershipRepository.findByUserIdAndProjectId(userId, projectId)
                .orElseThrow(ApiErrors.NotProjectMember::new);
    }

    private String writeJson(Map<String, Object> content) {
        try {
            return objectMapper.writeValueAsString(content == null ? Map.of() : content);
        } catch (Exception e) {
            throw new IllegalStateException("산출물 내용을 저장할 수 없습니다.", e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readJson(String json) {
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }
}
