package com.semes.reqops.domain.workflow.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.artifact.entity.ArtifactState;
import com.semes.reqops.domain.artifact.entity.DevIssueArtifact;
import com.semes.reqops.domain.artifact.repository.DevIssueArtifactRepository;
import com.semes.reqops.domain.issue.entity.DevIssue;
import com.semes.reqops.domain.issue.repository.DevIssueRepository;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.workflow.dto.BundleDto.*;
import com.semes.reqops.domain.workflow.entity.WorkBundle;
import com.semes.reqops.domain.workflow.repository.WorkBundleRepository;
import com.semes.reqops.global.exception.ApiErrors;
import com.semes.reqops.domain.knowledge.service.ProjectKnowledgeService;
import com.semes.reqops.domain.requirement.repository.RequirementVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@Service @RequiredArgsConstructor
public class BundleService {
    private final WorkBundleRepository bundles; private final DevIssueRepository issues;
    private final DevIssueArtifactRepository artifacts; private final MembershipRepository memberships;
    private final ObjectMapper objectMapper;
    private final ProjectKnowledgeService knowledge;
    private final RequirementVersionRepository versions;

    @Transactional
    public WorkBundle start(Long requirementId, Long versionId, Long actorId){
        bundles.findFirstByRequirementIdAndCurrentOrderByRevisionNoDesc(requirementId,1).ifPresent(b->{b.supersede();bundles.save(b);});
        return bundles.save(new WorkBundle(requirementId,versionId,(int)bundles.countByRequirementId(requirementId)+1,actorId));
    }
    @Transactional(readOnly=true)
    public BundleResponse current(Long projectId,Long requirementId,Long userId){member(projectId,userId);return response(find(requirementId));}
    @Transactional
    public BundleResponse confirm(Long projectId,Long requirementId,ConfirmRequest req){
        member(projectId,req.userId()); WorkBundle bundle=find(requirementId);
        if(bundle.getRowVersion()!=req.expectedRevision()) throw new ApiErrors.Conflict("작업 묶음이 변경되었습니다. 새로고침 후 다시 확인해주세요.");
        List<DevIssue> active=issues.findByRequirementIdAndIssueStateNotOrderByDisplayOrderAsc(requirementId,"RETIRED");
        if(active.isEmpty()) throw new ApiErrors.Conflict("확정할 개발 이슈가 없습니다.");
        List<Map<String,Object>> manifest=new ArrayList<>();
        for(DevIssue issue:active){
            List<DevIssueArtifact> docs=artifacts.findByDevIssueIdOrderByArtifactTypeAsc(issue.getId());
            if(docs.size()!=4 || docs.stream().anyMatch(a->a.getState()!=ArtifactState.CONFIRMED))
                throw new ApiErrors.Conflict("모든 활성 이슈의 산출물 4종을 먼저 확정해주세요.");
            manifest.add(Map.of("issueId",issue.getId(),"issueRevision",issue.getRowVersion(),"artifacts",docs.stream().map(a->Map.of("id",a.getId(),"type",a.getArtifactType().name(),"revision",a.getRowVersion())).toList()));
        }
        try{String json=objectMapper.writeValueAsString(manifest);bundle.confirm(json,sha256(json),req.userId());WorkBundle saved=bundles.save(bundle);if(saved.getRequirementVersionId()!=null)versions.findById(saved.getRequirementVersionId()).ifPresent(v->knowledge.project(projectId,"REQUIREMENT",requirementId,v.getId(),v.getContent()));for(DevIssue issue:active)for(DevIssueArtifact doc:artifacts.findByDevIssueIdOrderByArtifactTypeAsc(issue.getId()))knowledge.project(projectId,"ARTIFACT",doc.getId(),doc.getRowVersion(),doc.getContentJson());return response(saved);}
        catch(JsonProcessingException e){throw new IllegalStateException(e);}
    }
    private BundleResponse response(WorkBundle b){
        List<IssueSummary> rows=issues.findByRequirementIdAndIssueStateNotOrderByDisplayOrderAsc(b.getRequirementId(),"RETIRED").stream().map(i->new IssueSummary(i.getId(),i.getIssueKey(),i.getTitle(),i.getQuote(),i.getIssueState(),i.getRowVersion(),artifacts.findByDevIssueIdOrderByArtifactTypeAsc(i.getId()).stream().map(a->new ArtifactSummary(a.getId(),a.getArtifactType().slug(),a.getState().name(),a.getSchemaVersion(),a.getRowVersion())).toList())).toList();
        return new BundleResponse(b.getId(),b.getRequirementId(),b.getRevisionNo(),b.getState().name(),b.getRowVersion(),rows,b.getManifestJson());
    }
    private WorkBundle find(Long req){return bundles.findFirstByRequirementIdAndCurrentOrderByRevisionNoDesc(req,1).orElseThrow(()->new ApiErrors.Conflict("현재 작업 묶음이 없습니다."));}
    private void member(Long p,Long u){memberships.findByUserIdAndProjectId(u,p).orElseThrow(ApiErrors.NotProjectMember::new);}
    private String sha256(String s){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
