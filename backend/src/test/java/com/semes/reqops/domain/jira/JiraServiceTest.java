package com.semes.reqops.domain.jira;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.jira.dto.JiraDto.*;
import com.semes.reqops.domain.jira.entity.*;
import com.semes.reqops.domain.jira.repository.*;
import com.semes.reqops.domain.jira.service.*;
import com.semes.reqops.domain.project.entity.*;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.issue.entity.DevIssue;
import com.semes.reqops.domain.issue.repository.DevIssueRepository;
import com.semes.reqops.domain.requirement.entity.Requirement;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.artifact.entity.*;
import com.semes.reqops.domain.artifact.repository.DevIssueArtifactRepository;
import com.semes.reqops.domain.workflow.repository.WorkBundleRepository;
import com.semes.reqops.global.exception.ApiErrors;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JiraServiceTest {
    private static <T>T stub(Class<T> type){return mock(type,withSettings().mockMaker("mock-maker-subclass"));}
    final JiraTargetRepository targets=stub(JiraTargetRepository.class);
    final JiraIssueLinkRepository links=stub(JiraIssueLinkRepository.class);
    final MembershipRepository members=stub(MembershipRepository.class);
    final DevIssueRepository issues=stub(DevIssueRepository.class);
    final RequirementRepository requirements=stub(RequirementRepository.class);
    final DevIssueArtifactRepository artifacts=stub(DevIssueArtifactRepository.class);
    final WorkBundleRepository bundles=stub(WorkBundleRepository.class);
    final JiraClient client=stub(JiraClient.class);
    final ObjectMapper mapper=new ObjectMapper();
    final JiraService service=new JiraService(targets,links,members,issues,requirements,artifacts,bundles,client,mapper);
    JiraTarget target;
    void context(){
        when(members.findByUserIdAndProjectId(5L,1L)).thenReturn(Optional.of(new Membership(5L,1L,Role.MEMBER)));
        Requirement req=stub(Requirement.class);when(req.getProjectId()).thenReturn(1L);when(req.getContent()).thenReturn("충전 시작 SOC 30%");when(req.getReqKey()).thenReturn("REQ-03");when(requirements.findById(3L)).thenReturn(Optional.of(req));
        DevIssue issue=stub(DevIssue.class);when(issue.getRequirementId()).thenReturn(3L);when(issue.getTitle()).thenReturn("충전 기준 변경");when(issue.getIssueState()).thenReturn("DRAFT");when(issues.findById(7L)).thenReturn(Optional.of(issue));
        target=stub(JiraTarget.class);when(target.getId()).thenReturn(11L);when(target.getBaseUrl()).thenReturn("http://jira.example.test:18080");when(target.getJiraProjectKey()).thenReturn("AMR");when(target.getIssueTypeId()).thenReturn("10001");when(targets.lockTarget(11L,1L)).thenReturn(Optional.of(target));
    }
    @Test void openingExistingLinkDoesNotCreateOrOverwriteRemoteIssue(){
        context();when(links.findByTargetIdAndDevIssueId(11L,7L)).thenReturn(Optional.of(new JiraIssueLink(11L,7L,"AMR-123")));
        var result=service.open(1L,3L,7L,new OpenRequest(5L,11L));assertEquals("http://jira.example.test:18080/browse/AMR-123",result.url());assertFalse(result.created());verifyNoInteractions(client,artifacts);
    }
    @Test void allFourArtifactBodiesAreSentWithoutTruncation(){
        context();String text="고객 요청사항 SOC 50%에서 30%로 변경\n".repeat(300);
        when(artifacts.findByDevIssueIdOrderByArtifactTypeAsc(7L)).thenReturn(Arrays.stream(ArtifactType.values()).map(t->new DevIssueArtifact(7L,t,"{\"description\":"+quote(text)+"}","llm-api",5L)).toList());
        when(client.create(anyString(),anyMap())).thenReturn("AMR-124");when(links.saveAndFlush(any())).thenAnswer(call->call.getArgument(0));
        var result=service.open(1L,3L,7L,new OpenRequest(5L,11L));assertTrue(result.created());
        verify(client).create(eq("http://jira.example.test:18080"),argThat(fields->{String body=(String)fields.get("description");return body.contains(text)&&body.contains("SWVOC")&&body.contains("기능 요구사항")&&body.contains("비기능 요구사항")&&body.contains("Detail Design")&&body.contains("REQ-03");}));
    }
    private String quote(String text){try{return mapper.writeValueAsString(text);}catch(Exception e){throw new RuntimeException(e);}}
    @Test void differentProjectsAndNonMembersCannotCreateIssues(){
        assertThrows(ApiErrors.NotProjectMember.class,()->service.open(1L,3L,7L,new OpenRequest(5L,11L)));verifyNoInteractions(client);
        context();when(targets.lockTarget(11L,1L)).thenReturn(Optional.empty());assertThrows(ApiErrors.BadRequest.class,()->service.open(1L,3L,7L,new OpenRequest(5L,11L)));verifyNoInteractions(client);
    }
    @Test void membersCannotRegisterProjects(){
        context();assertThrows(ApiErrors.NotProjectOwner.class,()->service.save(1L,null,new TargetInput(5L,"http://jira.example.test","AMR","AMR",null,null)));verifyNoInteractions(client);verify(targets,never()).saveAndFlush(any());
    }
    @Test void registrationDoesNotCallJiraAndHasNoSmallFixedCountLimit(){
        when(members.findByUserIdAndProjectId(5L,1L)).thenReturn(Optional.of(new Membership(5L,1L,Role.OWNER)));
        when(targets.saveAndFlush(any())).thenAnswer(call->call.getArgument(0));
        for(int n=1;n<=6;n++){var response=service.save(1L,null,new TargetInput(5L,"http://jira.example.test:18080/","AMR"+n,"개발 "+n,null,null));assertEquals("AMR"+n,response.jiraProjectKey());assertNull(response.issueTypeId());}
        verifyNoInteractions(client);verify(targets,times(6)).saveAndFlush(any());
    }
}
