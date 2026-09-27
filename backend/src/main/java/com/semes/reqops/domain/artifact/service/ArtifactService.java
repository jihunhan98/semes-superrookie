package com.semes.reqops.domain.artifact.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.artifact.dto.ArtifactDto.ArtifactResponse;
import com.semes.reqops.domain.artifact.dto.ArtifactDto.ConfirmRequest;
import com.semes.reqops.domain.artifact.dto.ArtifactDto.RegenerateRequest;
import com.semes.reqops.domain.artifact.entity.ArtifactType;
import com.semes.reqops.domain.artifact.entity.DevIssueArtifact;
import com.semes.reqops.domain.artifact.repository.DevIssueArtifactRepository;
import com.semes.reqops.domain.artifact.repository.ArtifactRevisionRepository;
import com.semes.reqops.domain.artifact.entity.ArtifactRevision;
import com.semes.reqops.domain.issue.entity.DevIssue;
import com.semes.reqops.domain.issue.repository.DevIssueRepository;
import com.semes.reqops.domain.knowledge.entity.KnowledgeEntry;
import com.semes.reqops.domain.knowledge.entity.EvidenceLink;
import com.semes.reqops.domain.knowledge.repository.EvidenceLinkRepository;
import com.semes.reqops.domain.knowledge.service.ProjectKnowledgeService;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.entity.Requirement;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.requirement.repository.RequirementVersionRepository;
import com.semes.reqops.global.ai.AiAnalyzeDto;
import com.semes.reqops.global.ai.AiArtifactDto;
import com.semes.reqops.global.ai.AiClient;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * 산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design) 상세 — 개발 이슈 1건당 1개씩.
 *
 * <p>처음 열람할 때 저장된 내용이 없으면 그 자리에서 AI 초안을 만들어 DRAFT로
 * 저장한다(화면이 빈 채로 뜨면 안 되므로 — "이슈 나누기"의 preview와 달리 산출물
 * 화면은 별도 진입 단계가 없어 조회 자체가 최초 생성을 겸한다). 이후 조회는 저장된
 * 값을 그대로 돌려주고, 재생성·확정으로만 바뀐다.
 */
@Slf4j
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
    private final ArtifactRevisionRepository revisionRepository;
    private final ArtifactContentValidator validator;
    private final RequirementVersionRepository versionRepository;
    private final ProjectKnowledgeService knowledgeService;
    private final EvidenceLinkRepository evidenceLinkRepository;

    @Transactional(readOnly = true)
    public ArtifactResponse get(Long projectId, Long requirementId, String issueKey, String typeSlug, Long userId) {
        requireMember(projectId, userId);
        DevIssue issue = findIssue(projectId, requirementId, issueKey);
        ArtifactType type = ArtifactType.fromSlug(typeSlug);

        DevIssueArtifact artifact = artifactRepository.findByDevIssueIdAndArtifactType(issue.getId(), type)
                .orElseThrow(() -> new ApiErrors.Conflict("산출물 초안이 아직 준비되지 않았습니다."));
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
                type.slug(), issue.getTitle(), issue.getQuote(), content, reason, existingOf(projectId, requirementId));
        artifact.regenerate(writeJson(ai.content()), ai.engine());
        artifactRepository.save(artifact);
        saveRevision(artifact, blankToNull(req.reason()), req.userId());
        linkRequirementEvidence(projectId, requirementId, issue, artifact);
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
        validator.validateConfirmed(type, req.content());
        artifact.confirm(writeJson(req.content()), req.userId());
        artifactRepository.save(artifact);
        saveRevision(artifact, "사용자 확정", req.userId());
        linkRequirementEvidence(projectId, requirementId, issue, artifact);
        return toResponse(type, artifact);
    }

    /**
     * 이슈 나누기를 확정한 직후, 산출물 4종을 미리 만들어 둔다 — 호출한 쪽은
     * 기다리지 않는다({@code @Async}라서 이 메서드는 스레드풀에 작업만 던져놓고
     * 곧장 리턴된다). 이슈가 여러 개면 순식간에 수십 건이 쌓이는데, 그걸 한꺼번에
     * 다 쏘면 AI 서버·DB 커넥션 풀이 막혀 다른 요청까지 전부 느려진다 — 그래서
     * {@code aiTaskExecutor}(동시 3개, {@link com.semes.reqops.global.config.AsyncConfig})
     * 로만 처리해 나머지는 큐에서 순서대로 돈다.
     *
     * <p>실패해도 예외를 위로 던지지 않는다 — 로그만 남기고 넘어간다. 어차피 이건
     * "미리" 만들어 두는 것뿐이라, 실패한 것은 나중에 그 산출물을 실제로 열람할
     * 때 {@link #get}이 똑같은 방식으로 다시 시도한다.
     */
    @Async("aiTaskExecutor")
    public void warmDraftAsync(Long projectId, Long requirementId, String issueKey, String typeSlug, Long userId) {
        try {
            regenerate(projectId, requirementId, issueKey, typeSlug, new RegenerateRequest(userId, null));
        } catch (Exception e) {
            log.warn("산출물 미리 생성 실패(나중에 열람 시 다시 시도됨) — issue={} type={}: {}",
                    issueKey, typeSlug, e.getMessage());
        }
    }

    // ── 내부 구현 ────────────────────────────────────────────────

    private DevIssueArtifact createDraft(DevIssue issue, ArtifactType type, String reason, Long userId) {
        Requirement r = requirementRepository.findById(issue.getRequirementId())
                .orElseThrow(() -> new ApiErrors.RequirementNotFound(issue.getRequirementId()));
        AiArtifactDto.Response ai = aiClient.generateArtifact(
                type.slug(), issue.getTitle(), issue.getQuote(), r.getContent(), reason,
                existingOf(r.getProjectId(), r.getId()));
        return artifactRepository.save(
                new DevIssueArtifact(issue.getId(), type, writeJson(ai.content()), ai.engine(), userId));
    }

    @Transactional
    public void ensurePlaceholders(Long issueId, Long userId) {
        for (ArtifactType type : ArtifactType.values()) {
            artifactRepository.findByDevIssueIdAndArtifactType(issueId, type).orElseGet(() ->
                    artifactRepository.save(new DevIssueArtifact(issueId, type, writeJson(emptyV2(type)), "unavailable", userId)));
        }
    }

    private Map<String,Object> emptyV2(ArtifactType type) {
        Map<String,Object> extras = new java.util.LinkedHashMap<>();
        if (type == ArtifactType.VOC) return map("requester",null,"requestContent",null,"specialNotes",null,"legacyExtras",extras);
        if (type == ArtifactType.FUNCTIONAL || type == ArtifactType.NONFUNCTIONAL) {
            List<Map<String,Object>> rows = List.of(scenario("BASIC"),scenario("VARIANT"),scenario("EXCEPTION"));
            return map("overview",null,"constraintsNote",null,"scenarios",rows,"legacyExtras",extras);
        }
        return map("description",null,"classDiagram",null,"sequenceDiagramAsIs",null,"sequenceDiagramToBe",null,"asIsApplicability","UNKNOWN","asIsReason",null,"legacyExtras",extras);
    }
    private Map<String,Object> scenario(String type){return map("type",type,"precondition",null,"scenario",null,"postcondition",null,"applicability","UNKNOWN","reason",null);}
    private Map<String,Object> map(Object... values){Map<String,Object> out=new java.util.LinkedHashMap<>();for(int i=0;i<values.length;i+=2)out.put((String)values[i],values[i+1]);return out;}
    private void saveRevision(DevIssueArtifact artifact,String reason,Long actor){String json=artifact.getContentJson();revisionRepository.save(new ArtifactRevision(artifact.getId(),revisionRepository.countByArtifactId(artifact.getId())+1,artifact.getState(),json,hash(json),reason,actor));}
    private String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}

    /**
     * 같은 프로젝트의 다른 요구사항들 — req-1~4가 지금 다루는 req와 유기적으로 엮여
     * 있을 수 있어(같은 모듈·같은 판정 기준 등) 산출물 생성 프롬프트에 참고용으로
     * 함께 넘긴다. RequirementService.existingOf()와 같은 값(상충 검출용 existing을
     * 그대로 재사용) — 다른 도메인 서비스라 헬퍼만 따로 둔다.
     */
    private List<AiAnalyzeDto.Existing> existingOf(Long projectId, Long excludeId) {
        return requirementRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .filter(r -> !r.getId().equals(excludeId))
                .map(r -> new AiAnalyzeDto.Existing(r.getReqKey(), r.getContent()))
                .toList();
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

    private void linkRequirementEvidence(Long projectId, Long requirementId, DevIssue issue,
                                         DevIssueArtifact artifact) {
        Requirement requirement = requirementRepository.findById(requirementId)
                .orElseThrow(() -> new ApiErrors.RequirementNotFound(requirementId));
        versionRepository.findFirstByRequirementIdOrderByIdDesc(requirementId).ifPresent(version -> {
            KnowledgeEntry entry = knowledgeService.project(projectId, "REQUIREMENT", requirementId,
                    version.getId(), version.getContent());
            String quote = blankToNull(issue.getQuote()) == null ? version.getContent() : issue.getQuote();
            String quoteHash = hash(quote);
            if (!evidenceLinkRepository.existsByTargetTypeAndTargetIdAndKnowledgeEntryIdAndQuoteHash(
                    "ARTIFACT", artifact.getId(), entry.getId(), quoteHash)) {
                evidenceLinkRepository.save(new EvidenceLink(
                        "ARTIFACT", artifact.getId(), entry.getId(), quote, quoteHash));
            }
        });
    }
}
