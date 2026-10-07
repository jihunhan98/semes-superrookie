package com.semes.reqops.domain.insight;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.job.entity.*;
import com.semes.reqops.domain.job.repository.*;
import com.semes.reqops.domain.job.service.AiJobService;
import com.semes.reqops.domain.knowledge.repository.KnowledgeEntryRepository;
import com.semes.reqops.domain.knowledge.service.ProjectKnowledgeService;
import com.semes.reqops.domain.project.entity.Membership;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.entity.*;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.issue.repository.DevIssueRepository;
import com.semes.reqops.domain.artifact.repository.DevIssueArtifactRepository;
import com.semes.reqops.global.ai.AiClient;
import com.semes.reqops.global.exception.ApiErrors;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class InsightServiceTest {
    private static <T> T stub(Class<T> type){return org.mockito.Mockito.mock(type,withSettings().mockMaker("mock-maker-subclass"));}
    RequirementRepository requirements=stub(RequirementRepository.class);
    MembershipRepository memberships=stub(MembershipRepository.class);
    KnowledgeEntryRepository entries=stub(KnowledgeEntryRepository.class);
    ProjectKnowledgeService knowledge=stub(ProjectKnowledgeService.class);
    AiJobRepository jobs=stub(AiJobRepository.class);
    AiTaskRepository tasks=stub(AiTaskRepository.class);
    AiClient ai=stub(AiClient.class);
    InsightService service=new InsightService(requirements,memberships,entries,knowledge,jobs,tasks,stub(AiJobService.class),stub(DevIssueRepository.class),stub(DevIssueArtifactRepository.class),ai,new ObjectMapper());
    @BeforeEach void setup(){
        Requirement r=stub(Requirement.class);when(r.getId()).thenReturn(10L);when(r.getProjectId()).thenReturn(1L);when(r.getReqKey()).thenReturn("REQ-A");when(r.getContent()).thenReturn("SOC 30% 이상");when(r.getState()).thenReturn(ReqState.CONFIRMED);when(r.getVersion()).thenReturn("1.0.1");
        when(requirements.findById(10L)).thenReturn(Optional.of(r));when(requirements.findByProjectIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(r));
        AiJob saved=stub(AiJob.class);when(saved.getId()).thenReturn(11L);when(jobs.save(any())).thenReturn(saved);
    }
    @Test void enqueuesOriginalValuesAndAllRequirements(){
        service.enqueue(1L,10L,2L,"SOC 50% 이상","SOC 30% 이상",false);
        ArgumentCaptor<AiTask> captor=ArgumentCaptor.forClass(AiTask.class);verify(tasks).save(captor.capture());
        var input=service.read(captor.getValue().getInputJson());assertEquals("SOC 50% 이상",input.get("before"));assertEquals("SOC 30% 이상",input.get("after"));assertEquals(1,((List<?>)input.get("requirements")).size());assertNotNull(input.get("snapshotHash"));
    }
    @Test void repeatedChangeIsIdempotent(){
        when(jobs.findByProjectIdAndIdempotencyKey(eq(1L),anyString())).thenReturn(Optional.of(stub(AiJob.class)));
        service.enqueue(1L,10L,2L,"50%","30%",false);verify(tasks,never()).save(any());
    }
    @Test void staleInputIsStoredAsStaleWithoutAiCall(){
        service.executeImpact(11L,Map.of("projectId",1L,"snapshotHash","old"));
        verify(ai,never()).insight(anyString(),anyMap());
        ArgumentCaptor<String> json=ArgumentCaptor.forClass(String.class);verify(knowledge).project(eq(1L),eq("IMPACT"),eq(11L),eq(1L),json.capture());assertEquals("STALE",service.read(json.getValue()).get("status"));
    }
    @Test void nonMemberCannotReadOtherProjectsImpacts(){
        assertThrows(ApiErrors.NotProjectMember.class,()->service.impacts(1L,3L));verify(jobs,never()).findByProjectIdAndKindOrderByIdDesc(anyLong(),anyString());
    }
    @Test void cannotAcknowledgeAnotherProjectsJob(){
        when(memberships.findByUserIdAndProjectId(2L,1L)).thenReturn(Optional.of(stub(Membership.class)));
        AiJob foreign=stub(AiJob.class);when(foreign.getProjectId()).thenReturn(9L);when(jobs.findById(11L)).thenReturn(Optional.of(foreign));
        assertThrows(ApiErrors.BadRequest.class,()->service.markRead(1L,11L,2L));verifyNoInteractions(knowledge);
    }
}
