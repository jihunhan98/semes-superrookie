package com.semes.reqops.domain.requirement.service;

import com.semes.reqops.domain.knowledge.GlossaryService;
import com.semes.reqops.domain.project.entity.Membership;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.dto.RequirementDto.ConfirmRequest;
import com.semes.reqops.domain.requirement.entity.*;
import com.semes.reqops.domain.requirement.repository.*;
import com.semes.reqops.domain.review.entity.*;
import com.semes.reqops.domain.review.repository.*;
import com.semes.reqops.domain.workflow.service.BundleService;
import com.semes.reqops.global.ai.AiAnalyzeDto.ReviewContext;
import com.semes.reqops.global.exception.ApiErrors;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RequirementUnchangedConfirmationTest {
    @Mock MembershipRepository membershipRepository;
    @Mock RequirementRepository requirementRepository;
    @Mock RequirementAiDraftRepository aiDraftRepository;
    @Mock RequirementVersionRepository versionRepository;
    @Mock RequirementConsensusRepository consensusRepository;
    @Mock RequirementFindingRepository findingRepository;
    @Mock ReviewAnalysisStore reviewStore;
    @Mock GlossaryService glossaryService;
    @Mock BundleService bundleService;
    @Mock ReviewItemRepository reviewItemRepository;
    @Mock UserDecisionRepository userDecisionRepository;
    @InjectMocks RequirementService service;
    Requirement requirement;
    RequirementAiDraft review;
    RequirementService subject;
    final String original="IDLE 상태의 AMR에 작업을 배정한다.";

    @BeforeEach void setup() {
        requirement=new Requirement(1L,"REQ-01",original,"요청 부서","요청자",7L);
        ReflectionTestUtils.setField(requirement,"id",2L);
        when(membershipRepository.findByUserIdAndProjectId(7L,1L)).thenReturn(Optional.of(mock(Membership.class)));
        when(requirementRepository.findById(2L)).thenReturn(Optional.of(requirement));
        when(requirementRepository.findLockedById(2L)).thenReturn(Optional.of(requirement));
        review=new RequirementAiDraft(2L,original,"internal");
        when(aiDraftRepository.findFirstByRequirementIdOrderByIdDesc(2L)).thenReturn(Optional.of(review));
        reviewed(original,"USER_REVIEWED");
        when(reviewStore.existing(1L,2L)).thenReturn(List.of());
        when(reviewStore.existingHash(List.of())).thenReturn("existing");
        when(glossaryService.forAnalysis(1L)).thenReturn(List.of());
        when(glossaryService.hash(List.of())).thenReturn("terms");
        lenient().when(versionRepository.save(any())).thenAnswer(i->{RequirementVersion v=i.getArgument(0);ReflectionTestUtils.setField(v,"id",23L);return v;});
        subject=spy(service);lenient().doReturn(null).when(subject).detail(1L,2L,7L);
    }
    void reviewed(String text,String status) {
        when(reviewStore.context(review)).thenReturn(new ReviewContext(ReviewAnalysisStore.hash(text),"existing",status,0,0,"terms",0));
    }
    ConfirmRequest request(String text) {return new ConfirmRequest(7L,text,null,null,null);}
    void existingVersion(boolean revising) {
        requirement.confirm(original,"1.0.3");
        if(revising)requirement.startRevision();
        when(versionRepository.findFirstByRequirementIdOrderByIdDesc(2L)).thenReturn(Optional.of(new RequirementVersion(2L,"1.0.3","기존 확정",original,9L,7L)));
    }
    @Test void originalRegistrationConfirmsWithoutCreatingOrReadingConsensus() {
        subject.confirm(1L,2L,request(original));
        assertEquals(ReqState.CONFIRMED,requirement.getState());
        assertEquals("1.0.0",requirement.getVersion());
        var saved=ArgumentCaptor.forClass(RequirementVersion.class);
        verify(versionRepository).save(saved.capture());
        assertNull(saved.getValue().getConsensusId());
        assertEquals("등록 본문 그대로 확정",saved.getValue().getTitle());
        verifyNoInteractions(consensusRepository);
        verify(bundleService).start(2L,23L,7L);
    }
    @Test void changedBodyStillRequiresNewConsensus() {
        String changed=original+" 결과를 기록한다.";reviewed(changed,"USER_REVIEWED");
        assertThrows(ApiErrors.ConsensusRequired.class,()->subject.confirm(1L,2L,request(changed)));
        verify(versionRepository,never()).save(any());verifyNoInteractions(bundleService);
    }
    @Test void whitespaceEditsStillRequireConsensusButLineEndingEncodingDoesNot() {
        reviewed(original+" ","USER_REVIEWED");
        assertThrows(ApiErrors.ConsensusRequired.class,()->subject.confirm(1L,2L,request(original+" ")));
    }
    @Test void crlfAndLfAreTheSamePreviouslyAgreedBody() {
        ReflectionTestUtils.setField(requirement,"content","첫 문장\r\n둘째 문장");
        String content="첫 문장\n둘째 문장";reviewed(content,"USER_REVIEWED");
        subject.confirm(1L,2L,request(content));
        verifyNoInteractions(consensusRepository);
        assertEquals(content,requirement.getContent());
    }
    @Test void changedBodyWithMatchingNewConsensusStillConfirms() {
        String changed=original+" 결과를 기록한다.";reviewed(changed,"USER_REVIEWED");
        var consensus=new RequirementConsensus(2L,"메일","고객 담당자",LocalDate.of(2026,10,30),"변경 합의",changed,7L);
        ReflectionTestUtils.setField(consensus,"id",10L);
        when(consensusRepository.findFirstByRequirementIdOrderByIdDesc(2L)).thenReturn(Optional.of(consensus));
        subject.confirm(1L,2L,request(changed));
        var saved=ArgumentCaptor.forClass(RequirementVersion.class);verify(versionRepository).save(saved.capture());
        assertEquals(10L,saved.getValue().getConsensusId());assertEquals(changed,requirement.getContent());
    }
    @Test void confirmingAnUnchangedExistingVersionDoesNotRecreateBundleOrArtifacts() {
        existingVersion(false);subject.confirm(1L,2L,request(original));
        assertEquals("1.0.3",requirement.getVersion());assertEquals(ReqState.CONFIRMED,requirement.getState());
        verify(versionRepository,never()).save(any());verifyNoInteractions(consensusRepository,bundleService);
    }
    @Test void returningToTheExistingBodyRestoresConfirmedStateWithoutNewVersion() {
        existingVersion(true);subject.confirm(1L,2L,request(original));
        assertEquals("1.0.3",requirement.getVersion());assertEquals(ReqState.CONFIRMED,requirement.getState());
        verify(versionRepository,never()).save(any());verifyNoInteractions(consensusRepository,bundleService);
    }
    @Test void retainingAnUnchangedBlockingFindingRecordsTheActualRetentionReason() {
        var finding=new RequirementFinding(2L,"기존 요구사항과 상충",original,"상충 근거","수정안","REQ-02","analysis",0,original.length(),ReviewAnalysisStore.hash(original));
        finding.setReviewData("BLOCKING","{}");finding.keepOriginal();ReflectionTestUtils.setField(finding,"id",9L);
        when(findingRepository.findByRequirementIdOrderByIdAsc(2L)).thenReturn(List.of(finding));
        when(reviewItemRepository.save(any())).thenAnswer(i->{ReviewItem item=i.getArgument(0);ReflectionTestUtils.setField(item,"id",8L);return item;});
        subject.confirm(1L,2L,request(original));
        var saved=ArgumentCaptor.forClass(UserDecision.class);verify(userDecisionRepository).save(saved.capture());
        assertEquals("등록·기존 확정 본문을 변경하지 않고 유지했습니다.",ReflectionTestUtils.getField(saved.getValue(),"reason"));
        assertEquals("ACCEPTED_WITH_REASON",finding.getResolutionState());
        verifyNoInteractions(consensusRepository);
    }
    @Test void unchangedBodyCannotSkipIncompleteAiReview() {
        reviewed(original,"PARTIAL");
        assertThrows(ApiErrors.Conflict.class,()->subject.confirm(1L,2L,request(original)));
        verifyNoInteractions(consensusRepository,bundleService);
    }
}
