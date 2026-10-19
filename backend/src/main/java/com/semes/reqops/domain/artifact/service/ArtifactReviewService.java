package com.semes.reqops.domain.artifact.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.knowledge.repository.KnowledgeEntryRepository;
import com.semes.reqops.domain.knowledge.service.ProjectKnowledgeService;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.issue.repository.DevIssueRepository;
import com.semes.reqops.domain.artifact.repository.DevIssueArtifactRepository;
import com.semes.reqops.global.ai.AiClient;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/** Completeness review of requirements, development issues and artifacts. */
@Service @RequiredArgsConstructor
public class ArtifactReviewService {
    private final RequirementRepository requirements;
    private final MembershipRepository memberships;
    private final KnowledgeEntryRepository entries;
    private final ProjectKnowledgeService knowledge;
    private final DevIssueRepository issues;
    private final DevIssueArtifactRepository artifacts;
    private final AiClient ai;
    private final ObjectMapper mapper;

    public static String hash(String text) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch(Exception e) { throw new IllegalStateException(e); }
    }
    public String json(Object value) { try {return mapper.writeValueAsString(value);} catch(Exception e){throw new IllegalStateException(e);} }
    @SuppressWarnings("unchecked") public Map<String,Object> read(String value) {try{return mapper.readValue(value,Map.class);}catch(Exception e){throw new IllegalStateException(e);}}
    public void member(Long project, Long user) {memberships.findByUserIdAndProjectId(user,project).orElseThrow(ApiErrors.NotProjectMember::new);}
    public List<Map<String,Object>> snapshot(Long project) {
        return requirements.findByProjectIdOrderByCreatedAtDesc(project).stream().sorted(Comparator.comparing(r->r.getId()))
            .map(r->{Map<String,Object> row=new LinkedHashMap<>();row.put("id",r.getId());row.put("reqKey",r.getReqKey());row.put("content",r.getContent());row.put("version",r.getVersion());row.put("state",r.getState().name());return row;}).toList();
    }
    public Map<String,Object> coverageInput(Long project,Long reqId) {
        var r=requirements.findById(reqId).filter(x->x.getProjectId().equals(project)).orElseThrow(()->new ApiErrors.RequirementNotFound(reqId));
        List<Map<String,Object>> rows=new ArrayList<>();
        for(var issue:issues.findByRequirementIdAndIssueStateNotOrderByDisplayOrderAsc(reqId,"RETIRED")) {
            Map<String,Object> row=new LinkedHashMap<>();row.put("id",issue.getId());row.put("displayId",issue.getDisplayId());row.put("title",issue.getTitle());row.put("quote",issue.getQuote());row.put("content",issue.aiContent());
            row.put("artifacts",artifacts.findByDevIssueIdOrderByArtifactTypeAsc(issue.getId()).stream().map(a->Map.of("type",a.getArtifactType().slug(),"revision",a.getRowVersion(),"content",read(a.getContentJson()))).toList());rows.add(row);
        }
        return Map.of("reqKey",r.getReqKey(),"requirementContent",r.getContent(),"existing",snapshot(project),"issues",rows);
    }
    public Map<String,Object> coverage(Long project,Long reqId,Long user) {
        member(project,user);var input=coverageInput(project,reqId);String inputHash=hash(json(input));
        var result=new LinkedHashMap<>(ai.insight("/coverage",input));
        if(!inputHash.equals(hash(json(coverageInput(project,reqId)))))throw new ApiErrors.Conflict("검토 중 입력이 변경되었습니다. 다시 검토해 주세요.");
        result.put("inputHash",inputHash);result.put("checkedAt",Instant.now().toString());
        knowledge.project(project,"COVERAGE",reqId,System.currentTimeMillis(),json(result));return result;
    }
    public Map<String,Object> latestCoverage(Long project,Long reqId,Long user) {
        member(project,user);var input=coverageInput(project,reqId);
        return entries.findFirstByProjectIdAndSourceTypeAndSourceIdOrderByIdDesc(project,"COVERAGE",reqId).map(e->{Map<String,Object> r=new LinkedHashMap<>(read(e.getContent()));r.put("stale",!Objects.equals(r.get("inputHash"),hash(json(input))));return r;}).orElse(Map.of());
    }
}
