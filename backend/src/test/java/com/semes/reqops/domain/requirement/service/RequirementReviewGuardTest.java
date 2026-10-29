package com.semes.reqops.domain.requirement.service;

import com.semes.reqops.domain.requirement.dto.RequirementDto.ConfirmRequest;
import com.semes.reqops.domain.requirement.entity.*;
import com.semes.reqops.domain.requirement.repository.*;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.project.entity.Membership;
import com.semes.reqops.global.ai.AiAnalyzeDto.ReviewContext;
import com.semes.reqops.global.exception.ApiErrors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RequirementReviewGuardTest {
    @Mock MembershipRepository membershipRepository;
    @Mock RequirementRepository requirementRepository;
    @Mock RequirementAiDraftRepository aiDraftRepository;
    @Mock ReviewAnalysisStore reviewStore;
    @Mock RequirementFindingRepository findingRepository;
    @Mock com.semes.reqops.domain.review.repository.ReviewItemRepository reviewItemRepository;
    @Mock com.semes.reqops.domain.review.repository.UserDecisionRepository userDecisionRepository;
    @Mock com.semes.reqops.domain.knowledge.GlossaryService glossaryService;
    @Mock com.semes.reqops.domain.knowledge.ClarificationStore clarificationStore;
    @Mock RequirementConsensusRepository consensusRepository;
    @InjectMocks RequirementService service;
    void member() {
        when(membershipRepository.findByUserIdAndProjectId(7L,1L)).thenReturn(Optional.of(mock(Membership.class)));
        Requirement r=mock(Requirement.class);
        when(r.getProjectId()).thenReturn(1L);
        when(requirementRepository.findById(2L)).thenReturn(Optional.of(r));
        when(requirementRepository.findLockedById(2L)).thenReturn(Optional.of(r));
    }
    @Test void unresolvedTemplateCannotBeConfirmedViaApi() {
        member();
        ApiErrors.Conflict error=assertThrows(ApiErrors.Conflict.class,()->service.confirm(1L,2L,new ConfirmRequest(7L,"⟦시간: 입력 필요⟧","제목",null,null)));
        assertTrue(error.getMessage().contains("입력이 필요한"));
    }
    @Test void manuallyChangedBodyRequiresFreshAnalysis() {
        member();
        when(reviewStore.context(null)).thenReturn(new ReviewContext(ReviewAnalysisStore.hash("이전 본문"),"hash","COMPLETE",0,0));
        ApiErrors.Conflict error=assertThrows(ApiErrors.Conflict.class,()->service.confirm(1L,2L,new ConfirmRequest(7L,"수정 본문","제목",null,null)));
        assertTrue(error.getMessage().contains("재검토"));
    }
    @Test void changedExistingRequirementsRequireFreshAnalysis() {
        member();
        when(reviewStore.context(null)).thenReturn(new ReviewContext(ReviewAnalysisStore.hash("본문"),"old","COMPLETE",0,0));
        when(reviewStore.existing(1L,2L)).thenReturn(List.of());
        when(reviewStore.existingHash(List.of())).thenReturn("new");
        ApiErrors.Conflict error=assertThrows(ApiErrors.Conflict.class,()->service.confirm(1L,2L,new ConfirmRequest(7L,"본문","제목",null,null)));
        assertTrue(error.getMessage().contains("다른 요구사항"));
    }
    void freshReview(String glossaryHash) {
        member();
        when(reviewStore.context(null)).thenReturn(new ReviewContext(ReviewAnalysisStore.hash("본문"),"existing","COMPLETE",0,0,glossaryHash,0));
        when(reviewStore.existing(1L,2L)).thenReturn(List.of());
        when(reviewStore.existingHash(List.of())).thenReturn("existing");
        when(glossaryService.forAnalysis(1L)).thenReturn(List.of());
        when(glossaryService.hash(List.of())).thenReturn("current");
    }
    @Test void changedGlossaryRequiresFreshAnalysis() {
        freshReview("old");
        var error=assertThrows(ApiErrors.Conflict.class,()->service.confirm(1L,2L,new ConfirmRequest(7L,"본문","제목",null,null)));
        assertTrue(error.getMessage().contains("용어사전"));
    }
    @Test void proposalDecisionsMustBeSavedBeforeConfirmation() {
        freshReview("current");
        var error=assertThrows(ApiErrors.Conflict.class,()->service.confirm(1L,2L,new ConfirmRequest(7L,"본문","제목",null,null)));
        assertTrue(error.getMessage().contains("결정을 저장"));
        verifyNoInteractions(consensusRepository);
    }
    @Test void savedUserReviewContinuesToCustomerConsensus() {
        freshReview("current");
        when(reviewStore.context(null)).thenReturn(new ReviewContext(ReviewAnalysisStore.hash("본문"),"existing","USER_REVIEWED",0,0,"current",0));
        when(consensusRepository.findFirstByRequirementIdOrderByIdDesc(2L)).thenReturn(Optional.empty());
        assertThrows(ApiErrors.ConsensusRequired.class,()->service.confirm(1L,2L,new ConfirmRequest(7L,"본문","제목",null,null)));
    }
    RequirementService decisionSetup(String content, com.semes.reqops.global.ai.AiAnalyzeDto.Proposal proposal) {
        member();
        RequirementFinding finding = new RequirementFinding(2L,"시간·일정 모호",content,"이유","제안",null,"analysis",0,content.length(),ReviewAnalysisStore.hash(content));
        when(findingRepository.findById(9L)).thenReturn(Optional.of(finding));
        when(reviewStore.context(null)).thenReturn(new ReviewContext(ReviewAnalysisStore.hash(content),"hash","COMPLETE",0,0));
        lenient().when(reviewStore.response(finding)).thenReturn(new com.semes.reqops.domain.requirement.dto.RequirementDto.FindingResponse(null,"시간·일정 모호",content,"이유","제안",null,"ADVISORY","OPEN",List.of(proposal),null,null,0,content.length()));
        lenient().when(reviewStore.json(any())).thenReturn("{}");
        lenient().when(reviewItemRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        RequirementService spy = spy(service);
        lenient().doReturn(null).when(spy).detail(1L,2L,7L);
        return spy;
    }
    @Test void applyIsAuditedWithoutResolvingFinding() {
        String content="응답을 기다린다.";
        var p=new com.semes.reqops.global.ai.AiAnalyzeDto.Proposal("변경","REPLACE",content,"다시 기다린다.",0,content.length(),false);
        RequirementService subject=decisionSetup(content,p);
        subject.decide(1L,2L,9L,new com.semes.reqops.domain.requirement.dto.RequirementDto.DecisionRequest(7L,"APPLY",content,null,0,0,content.length(),"다시 기다린다."));
        verify(userDecisionRepository).save(any());
        verify(findingRepository,never()).save(any());
    }
    @Test void applyRejectsContentThatDoesNotMatchSelectedProposal() {
        String content="응답을 기다린다.";
        var p=new com.semes.reqops.global.ai.AiAnalyzeDto.Proposal("변경","REPLACE",content,"다시 기다린다.",0,content.length(),false);
        RequirementService subject=decisionSetup(content,p);
        assertThrows(ApiErrors.Conflict.class,()->subject.decide(1L,2L,9L,new com.semes.reqops.domain.requirement.dto.RequirementDto.DecisionRequest(7L,"APPLY",content,null,0,0,content.length(),"무관한 본문")));
        verify(userDecisionRepository,never()).save(any());
    }
    @Test void insertionAndUndoUseTheSamePreciseProposal() {
        String content="응답을 기다린다.";
        var p=new com.semes.reqops.global.ai.AiAnalyzeDto.Proposal("추가","INSERT_AFTER",content,"실패를 기록한다.",0,content.length(),false);
        RequirementService subject=decisionSetup(content,p);
        String result=content+"\n실패를 기록한다.";
        subject.decide(1L,2L,9L,new com.semes.reqops.domain.requirement.dto.RequirementDto.DecisionRequest(7L,"APPLY",content,null,0,0,content.length(),result));
        subject.decide(1L,2L,9L,new com.semes.reqops.domain.requirement.dto.RequirementDto.DecisionRequest(7L,"UNDO",result,null,0,content.length(),result.length(),content));
        verify(userDecisionRepository,times(2)).save(any());
    }

}
