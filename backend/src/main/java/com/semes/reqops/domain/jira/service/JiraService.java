package com.semes.reqops.domain.jira.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.jira.dto.JiraDto.*;
import com.semes.reqops.domain.jira.entity.*;
import com.semes.reqops.domain.jira.repository.*;
import com.semes.reqops.domain.project.entity.Role;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.issue.repository.DevIssueRepository;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.artifact.repository.DevIssueArtifactRepository;
import com.semes.reqops.domain.artifact.entity.ArtifactType;
import com.semes.reqops.domain.workflow.repository.WorkBundleRepository;
import com.semes.reqops.domain.workflow.entity.BundleState;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service @RequiredArgsConstructor
public class JiraService {
    private final JiraTargetRepository targets;
    private final JiraIssueLinkRepository links;
    private final MembershipRepository members;
    private final DevIssueRepository issues;
    private final RequirementRepository requirements;
    private final DevIssueArtifactRepository artifacts;
    private final WorkBundleRepository bundles;
    private final JiraClient client;
    private final ObjectMapper mapper;

    @Transactional(readOnly=true)
    public List<TargetResponse> list(Long projectId,Long userId){member(projectId,userId,false);return targets.findByProjectIdOrderByIdAsc(projectId).stream().map(this::response).toList();}
    @Transactional
    public TargetResponse save(Long projectId,Long id,TargetInput input){
        member(projectId,input.userId(),true);
        String base=JiraAddress.normalize(input.baseUrl()),key=input.jiraProjectKey().trim().toUpperCase(Locale.ROOT),name=input.displayName().trim();
        if(!key.matches("[A-Z][A-Z0-9_]*")||name.isBlank())throw new ApiErrors.BadRequest("프로젝트 키와 이름을 확인해주세요.");
        String type=input.issueTypeId()==null||input.issueTypeId().isBlank()?null:input.issueTypeId();
        JiraTarget target;
        if(id==null){
            if(targets.existsByProjectIdAndBaseUrlAndJiraProjectKey(projectId,base,key))throw new ApiErrors.Conflict("이미 등록한 Jira 프로젝트입니다.");
            target=new JiraTarget(projectId,base,key,name,type);
        }else{
            target=target(projectId,id);
            if(input.expectedRevision()==null||input.expectedRevision()!=target.getRevision())throw new ApiErrors.Conflict("설정이 변경되었습니다. 새로고침 후 다시 수정해주세요.");
            if(links.existsByTargetId(id)&&(!target.getBaseUrl().equals(base)||!target.getJiraProjectKey().equals(key)))throw new ApiErrors.Conflict("연결된 이슈가 있어 Jira 주소와 프로젝트 키를 바꿀 수 없습니다. 다른 프로젝트로 추가해주세요.");
            boolean duplicate=targets.findByProjectIdOrderByIdAsc(projectId).stream().anyMatch(t->!t.getId().equals(id)&&t.getBaseUrl().equals(base)&&t.getJiraProjectKey().equals(key));
            if(duplicate)throw new ApiErrors.Conflict("이미 등록한 Jira 프로젝트입니다.");
            target.update(base,key,name,type);
        }
        return response(targets.saveAndFlush(target));
    }
    @Transactional
    public void delete(Long projectId,Long id,Long userId){member(projectId,userId,true);JiraTarget target=target(projectId,id);if(links.existsByTargetId(id))throw new ApiErrors.Conflict("Jira 이슈가 연결되어 있어 등록 정보를 삭제할 수 없습니다.");targets.delete(target);}
    @Transactional(readOnly=true)
    public List<IssueLinkResponse> issueLinks(Long projectId,Long requirementId,Long userId){
        member(projectId,userId,false);requirement(projectId,requirementId);
        Set<Long> ids=new HashSet<>();issues.findByRequirementIdOrderByDisplayOrderAsc(requirementId).forEach(i->ids.add(i.getId()));
        return targets.findByProjectIdOrderByIdAsc(projectId).stream().flatMap(t->links.findByTargetId(t.getId()).stream().filter(l->ids.contains(l.getDevIssueId())).map(l->link(t,l,false))).toList();
    }
    @Transactional
    public IssueLinkResponse open(Long projectId,Long requirementId,Long issueId,OpenRequest input){
        member(projectId,input.userId(),false);
        var requirement=requirement(projectId,requirementId);
        var issue=issues.findById(issueId).filter(i->i.getRequirementId().equals(requirementId)&&!"RETIRED".equals(i.getIssueState())).orElseThrow(()->new ApiErrors.DevIssueNotFound(issueId.toString()));
        // Serialize creation for this target so repeated clicks reuse the same Jira issue.
        JiraTarget target=targets.lockTarget(input.targetId(),projectId).orElseThrow(()->new ApiErrors.BadRequest("등록된 Jira 프로젝트를 선택해주세요."));
        var existing=links.findByTargetIdAndDevIssueId(target.getId(),issueId);
        if(existing.isPresent())return link(target,existing.get(),false);
        if(target.getIssueTypeId()==null)throw new ApiErrors.Conflict("프로젝트 설정에서 Jira 이슈 유형 ID를 입력해주세요.");
        bundles.findFirstByRequirementIdAndCurrentOrderByRevisionNoDesc(requirementId,1).ifPresent(b->{if(b.getState()==BundleState.GENERATING)throw new ApiErrors.Conflict("산출물 생성이 끝난 후 Jira에 등록해주세요.");});
        var docs=artifacts.findByDevIssueIdOrderByArtifactTypeAsc(issueId);
        if(docs.size()!=4 || docs.stream().anyMatch(d->"unavailable".equals(d.getEngine())))throw new ApiErrors.Conflict("산출물 4종을 생성한 후 Jira에 등록해주세요.");
        StringBuilder description=new StringBuilder(JiraContent.issue(issue,requirement));
        for(var doc:docs){try{description.append(JiraContent.artifact(label(doc.getArtifactType()),mapper.readTree(doc.getContentJson())));}catch(Exception e){throw new ApiErrors.Conflict("산출물 내용을 읽을 수 없습니다. 다시 생성한 후 시도해주세요.");}}
        // Jira summary has a 255-character limit; never silently cut off user content.
        if(issue.getTitle().length()>255)throw new ApiErrors.BadRequest("Jira 제목은 255자 이내여야 합니다.");
        String key=client.create(target.getBaseUrl(),Map.of("project",Map.of("key",target.getJiraProjectKey()),"issuetype",Map.of("id",target.getIssueTypeId()),"summary",issue.getTitle(),"description",description.toString(),"labels",List.of("reqops","reqops-dev-"+issueId)));
        var saved=links.saveAndFlush(new JiraIssueLink(target.getId(),issueId,key));
        return link(target,saved,true);
    }
    @Transactional(readOnly=true)
    public List<Map<String,Object>> incoming(Long projectId,Long requirementId,Long issueId,Long userId){
        member(projectId,userId,false);requirement(projectId,requirementId);
        issues.findById(issueId).filter(i->i.getRequirementId().equals(requirementId)).orElseThrow(()->new ApiErrors.DevIssueNotFound(issueId.toString()));
        List<Map<String,Object>> result=new ArrayList<>();
        for(var target:targets.findByProjectIdOrderByIdAsc(projectId)){
            var saved=links.findByTargetIdAndDevIssueId(target.getId(),issueId);
            if(saved.isEmpty())continue;
            var source=saved.get().getJiraIssueKey();
            var node=client.readIssue(target.getBaseUrl(),source);
            for(var relation:node.path("fields").path("issuelinks")){
                var incoming=relation.path("inwardIssue");
                if(incoming.isMissingNode())continue;
                String key=incoming.path("key").asText();
                if(!key.matches("[A-Za-z][A-Za-z0-9_]*-[0-9]+"))continue;
                result.add(Map.of("sourceKey",source,"key",key,"title",incoming.path("fields").path("summary").asText(),
                    "state",incoming.path("fields").path("status").path("name").asText(),"relation",relation.path("type").path("inward").asText(),"url",target.getBaseUrl()+"/browse/"+key));
            }
        }
        return result;
    }
    private String label(ArtifactType type){return switch(type){case VOC->"SWVOC";case FUNCTIONAL->"기능 요구사항";case NONFUNCTIONAL->"비기능 요구사항";case DETAIL_DESIGN->"Detail Design";};}
    private com.semes.reqops.domain.requirement.entity.Requirement requirement(Long projectId,Long id){return requirements.findById(id).filter(r->r.getProjectId().equals(projectId)).orElseThrow(()->new ApiErrors.RequirementNotFound(id));}
    private JiraTarget target(Long projectId,Long id){return targets.findByIdAndProjectId(id,projectId).orElseThrow(()->new ApiErrors.BadRequest("등록된 Jira 프로젝트를 찾을 수 없습니다."));}
    private void member(Long projectId,Long userId,boolean owner){var m=members.findByUserIdAndProjectId(userId,projectId).orElseThrow(ApiErrors.NotProjectMember::new);if(owner&&m.getRole()!=Role.OWNER)throw new ApiErrors.NotProjectOwner();}
    private TargetResponse response(JiraTarget t){return new TargetResponse(t.getId(),t.getBaseUrl(),t.getJiraProjectKey(),t.getDisplayName(),t.getIssueTypeId(),t.getRevision());}
    private IssueLinkResponse link(JiraTarget t,JiraIssueLink l,boolean created){return new IssueLinkResponse(t.getId(),l.getDevIssueId(),l.getJiraIssueKey(),t.getBaseUrl()+"/browse/"+l.getJiraIssueKey(),created);}
}
