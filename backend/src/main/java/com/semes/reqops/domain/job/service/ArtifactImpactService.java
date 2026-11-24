package com.semes.reqops.domain.job.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.artifact.entity.ArtifactState;
import com.semes.reqops.domain.artifact.entity.DevIssueArtifact;
import com.semes.reqops.domain.artifact.repository.DevIssueArtifactRepository;
import com.semes.reqops.domain.issue.dto.IssueDto.IssueResponse;
import com.semes.reqops.domain.requirement.repository.RequirementVersionRepository;
import com.semes.reqops.global.ai.AiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Compares the newly confirmed requirement with its preceding version before scheduling work. */
@Service @RequiredArgsConstructor @Slf4j
public class ArtifactImpactService {
    private static final List<String> TYPES=List.of("voc","functional","nonfunctional","detail-design");
    private final RequirementVersionRepository versions;
    private final DevIssueArtifactRepository artifacts;
    private final AiClient aiClient;
    private final ObjectMapper mapper;

    public record Target(Long issueId,String issueKey,String type,String reason) {}

    public List<Target> plan(Long requirementId,List<IssueResponse> issues) {
        var history=versions.findByRequirementIdOrderByIdDesc(requirementId);
        String oldContent=history.size()>1?history.get(1).getContent():history.isEmpty()?null:history.get(0).getContent();
        String newContent=history.isEmpty()?null:history.get(0).getContent();
        List<Target> result=new ArrayList<>();
        List<Map<String,Object>> candidates=new ArrayList<>();
        Set<String> saved=new HashSet<>();
        for(var issue:issues) {
            Map<String,DevIssueArtifact> byType=new LinkedHashMap<>();
            for(var doc:artifacts.findByDevIssueIdOrderByArtifactTypeAsc(issue.id()))byType.put(doc.getArtifactType().slug(),doc);
            List<Map<String,Object>> possible=new ArrayList<>();
            for(String type:TYPES) {
                DevIssueArtifact doc=byType.get(type);
                if(doc==null||"unavailable".equals(doc.getEngine())||"rule".equals(doc.getEngine())) {
                    result.add(new Target(issue.id(),issue.issueKey(),type,null));
                } else if(doc.getState()!=ArtifactState.CONFIRMED) {
                    result.add(new Target(issue.id(),issue.issueKey(),type,revisionReason(oldContent,newContent)));
                } else if(!"CONFIRMED".equals(issue.state())||oldContent!=null&&!oldContent.equals(newContent)) {
                    try {
                        possible.add(Map.of("type",type,"content",mapper.readTree(doc.getContentJson())));
                        saved.add(issue.id()+":"+type);
                    } catch(Exception e) {
                        result.add(new Target(issue.id(),issue.issueKey(),type,revisionReason(oldContent,newContent)));
                    }
                }
            }
            if(!possible.isEmpty())candidates.add(Map.of("id",issue.id(),"title",issue.title(),
                    "quote",issue.quote()==null?"":issue.quote(),"artifacts",possible));
        }
        if(!candidates.isEmpty()) {
            Set<String> affected=new HashSet<>();
            try {
                var response=aiClient.insight("/artifacts/impact",Map.of("oldContent",oldContent,"newContent",newContent,"issues",candidates));
                Object raw=response.get("impacts");
                if(!response.containsKey("engine")||!(raw instanceof List<?>))
                    throw new IllegalStateException("영향 판단 결과가 불완전합니다.");
                List<?> rows=(List<?>)raw;
                if(rows.size()!=saved.size())throw new IllegalStateException("영향 판단 결과가 불완전합니다.");
                Set<String> seen=new HashSet<>();
                for(Object value:rows) {
                    if(!(value instanceof Map<?,?> row)||!(row.get("issueId") instanceof Number id)
                            ||!(row.get("type") instanceof String type)||!(row.get("affected") instanceof Boolean decision))
                        throw new IllegalStateException("영향 판단 결과 형식이 맞지 않습니다.");
                    String key=id.longValue()+":"+type;
                    if(!saved.contains(key)||!seen.add(key))throw new IllegalStateException("영향 판단 대상이 맞지 않습니다.");
                    if(decision)affected.add(key);
                }
            } catch(Exception e) {
                // When impact cannot be established, recheck saved documents rather than silently retaining stale evidence.
                log.warn("산출물 영향 판단 실패. 기존 산출물을 재검토합니다: {}",e.getMessage());
                affected.addAll(saved);
            }
            for(var issue:issues)for(String type:TYPES)if(affected.contains(issue.id()+":"+type))
                result.add(new Target(issue.id(),issue.issueKey(),type,revisionReason(oldContent,newContent)));
        }
        return result;
    }

    private String revisionReason(String oldContent,String newContent) {
        if(oldContent==null)return "현재 저장된 산출물을 기준으로 수정된 개발 이슈와 관련된 부분만 반영하고 나머지는 유지하세요.";
        return "이전 확정 요구사항과 새 확정 요구사항의 차이가 이 산출물에 미치는 부분만 수정하세요. "
                + "관련 없는 필드와 기존 합의 내용은 유지하세요.\n이전 확정 요구사항:\n"
                + oldContent + "\n새 확정 요구사항:\n" + newContent;
    }
}
