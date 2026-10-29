package com.semes.reqops.domain.requirement.service;
import com.semes.reqops.domain.requirement.dto.RequirementDto.*;
import com.semes.reqops.domain.requirement.entity.*;
import com.semes.reqops.domain.requirement.repository.*;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.project.entity.Membership;
import com.semes.reqops.domain.knowledge.*;
import com.semes.reqops.global.ai.AiAnalyzeDto.*;
import com.semes.reqops.global.exception.ApiErrors;
import com.semes.reqops.domain.review.repository.*;
import com.semes.reqops.domain.review.entity.ReviewItem;
import org.junit.jupiter.api.*;import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;import org.mockito.junit.jupiter.MockitoExtension;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;import static org.mockito.Mockito.*;
@ExtendWith(MockitoExtension.class)
class CompleteProposalReviewTest {
 @Mock MembershipRepository membershipRepository; @Mock RequirementRepository requirementRepository;
 @Mock RequirementAiDraftRepository aiDraftRepository; @Mock RequirementFindingRepository findingRepository;
 @Mock ReviewAnalysisStore reviewStore; @Mock GlossaryService glossaryService; @Mock ClarificationStore clarificationStore;
 @Mock ReviewItemRepository reviewItemRepository; @Mock UserDecisionRepository userDecisionRepository;
 @InjectMocks RequirementService service;
 final String text="응답을 기다린다.";
 RequirementAiDraft draft;
 @BeforeEach void setup(){
  var r=mock(Requirement.class);when(r.getProjectId()).thenReturn(1L);
  when(membershipRepository.findByUserIdAndProjectId(7L,1L)).thenReturn(Optional.of(mock(Membership.class)));
  when(requirementRepository.findById(2L)).thenReturn(Optional.of(r));when(requirementRepository.findLockedById(2L)).thenReturn(Optional.of(r));
  draft=new RequirementAiDraft(2L,text,"internal");
  when(aiDraftRepository.findFirstByRequirementIdOrderByIdDesc(2L)).thenReturn(Optional.of(draft));
  when(reviewStore.context(draft)).thenReturn(new ReviewContext("source","existing","COMPLETE",0,0,"terms",0));
 }
 void fresh(){when(reviewStore.existing(1L,2L)).thenReturn(List.of());when(reviewStore.existingHash(List.of())).thenReturn("existing");when(glossaryService.forAnalysis(1L)).thenReturn(List.of());when(glossaryService.hash(List.of())).thenReturn("terms");}
 @Test void staleAnalysisCannotOverwriteNewerReview(){
  assertThrows(ApiErrors.Conflict.class,()->service.completeReview(1L,2L,new CompleteReviewRequest(7L,"old",text,false,List.of())));
  verify(aiDraftRepository,never()).saveAndFlush(any());
 }
 @Test void changedOtherRequirementRequiresNewAnalysis(){
  when(reviewStore.existing(1L,2L)).thenReturn(List.of());when(reviewStore.existingHash(List.of())).thenReturn("new-existing");
  assertThrows(ApiErrors.Conflict.class,()->service.completeReview(1L,2L,new CompleteReviewRequest(7L,"source",text,false,List.of())));
  verifyNoInteractions(userDecisionRepository);
 }
 @Test void userDecisionsAndFinalSnapshotAreStoredWithoutNewModelCall(){
  fresh();
  var f=mock(RequirementFinding.class);when(f.getId()).thenReturn(9L);when(f.getInputHash()).thenReturn("source");when(f.getResolutionState()).thenReturn("OPEN");
  when(f.getSpanStart()).thenReturn(0);when(f.getSpanEnd()).thenReturn(text.length());when(f.getTargetSpan()).thenReturn(text);
  when(f.getFindingType()).thenReturn("수치·판단 기준 불명확");when(f.getReason()).thenReturn("대기시간 누락");
  when(findingRepository.findByRequirementIdOrderByIdAsc(2L)).thenReturn(List.of(f));
  when(reviewItemRepository.save(any())).thenAnswer(i->i.getArgument(0));when(reviewStore.json(any())).thenReturn("{}");
  var subject=spy(service);doReturn(null).when(subject).detail(1L,2L,7L);
  subject.completeReview(1L,2L,new CompleteReviewRequest(7L,"source","3초 동안 응답을 기다린다.",false,List.of(new ProposalDecision(9L,"EDIT",null,"3초 동안 응답을 기다린다.",null))));
  verify(f).resolve();verify(userDecisionRepository).save(any());
  var cap=ArgumentCaptor.forClass(RequirementAiDraft.class);verify(aiDraftRepository).saveAndFlush(cap.capture());
  assertEquals("3초 동안 응답을 기다린다.",cap.getValue().getDraftContent());
  verify(clarificationStore).reconcile(eq(2L),eq("3초 동안 응답을 기다린다."),eq(List.of()),eq("USER_REVIEWED"),eq(0),eq("COMPLETE"),eq("terms"));
 }
}
