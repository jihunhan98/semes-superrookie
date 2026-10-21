package com.semes.reqops.domain.requirement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.requirement.entity.*;
import com.semes.reqops.domain.requirement.repository.*;
import com.semes.reqops.global.ai.AiAnalyzeDto.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ReviewAnalysisStoreTest {
    private static <T> T stub(Class<T> type) { return mock(type, withSettings().mockMaker("mock-maker-subclass")); }
    RequirementRepository requirements = stub(RequirementRepository.class);
    RequirementFindingRepository findings = stub(RequirementFindingRepository.class);
    RequirementAiDraftRepository drafts = stub(RequirementAiDraftRepository.class);
    ReviewAnalysisStore store = new ReviewAnalysisStore(requirements, findings, drafts, new ObjectMapper());
    ReviewAnalysisStoreTest() {
        when(requirements.findLockedById(1L)).thenReturn(Optional.of(stub(Requirement.class)));
        when(findings.findByRequirementIdOrderByIdAsc(1L)).thenReturn(List.of());
    }
    @Test void repeatedTextWithoutExactLocationIsNotExecutable() {
        String text = "동일 문장. 동일 문장.";
        Finding f = new Finding("시간·일정 모호", "동일 문장.", "이유", "제안", null);
        store.save(1L, text, new Response(List.of(f), text, "rule", "full-context", 0), List.of(), false);
        verify(findings, never()).save(any());
    }
    @Test void ungroundedBlockingIsDowngradedAndInvalidEditIsRemoved() {
        String text = "상태를 보고한다.";
        Proposal bad = new Proposal("변경", "REPLACE", "없는 원문", "다른 문장", 0, text.length(), false);
        Finding f = new Finding("시간·일정 모호",text,"이유","제안",null,"BLOCKING",List.of(bad),"해석 차이",null,0,text.length());
        store.save(1L,text,new Response(List.of(f),text,"rule","full-context",0),List.of(),false);
        ArgumentCaptor<RequirementFinding> cap=ArgumentCaptor.forClass(RequirementFinding.class);
        verify(findings).save(cap.capture());
        assertEquals("ADVISORY",cap.getValue().getSeverity());
        assertTrue(store.response(cap.getValue()).proposals().isEmpty());
    }
    @Test void initialQueueCannotOverwriteNewerManualReview() {
        RequirementAiDraft latest = new RequirementAiDraft(1L,"새 본문","rule");
        latest.setReviewData("{}");
        when(drafts.findFirstByRequirementIdOrderByIdDesc(1L)).thenReturn(Optional.of(latest));
        store.save(1L,"이전 본문",new Response(List.of(),"이전 본문","rule","full",0),List.of(),true);
        verify(drafts,never()).save(any());
        verify(findings,never()).deleteByRequirementIdAndResolutionState(any(),any());
    }
    @Test void hashIncludesStateVersionAndTextButNotQueryOrder() {
        Existing a=new Existing("REQ-A","내용 A","CONFIRMED","1.0.0"), b=new Existing("REQ-B","내용 B");
        assertEquals(store.existingHash(List.of(a,b)),store.existingHash(List.of(b,a)));
        assertNotEquals(store.existingHash(List.of(a)),store.existingHash(List.of(new Existing("REQ-A","내용 A","REVISING","1.0.0"))));
    }
}
