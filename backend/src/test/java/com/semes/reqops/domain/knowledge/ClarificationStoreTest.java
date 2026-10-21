package com.semes.reqops.domain.knowledge;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.requirement.service.ReviewAnalysisStore;
import com.semes.reqops.global.ai.AiAnalyzeDto.*;
import org.junit.jupiter.api.Test;import java.util.*;
import static org.junit.jupiter.api.Assertions.*;import static org.mockito.Mockito.*;
class ClarificationStoreTest {
 static <T>T stub(Class<T> type){return mock(type,withSettings().mockMaker("mock-maker-subclass"));}
 RequirementRefinementRepository refinements=stub(RequirementRefinementRepository.class);ClarificationQuestionRepository questions=stub(ClarificationQuestionRepository.class);
 ObjectMapper mapper=new ObjectMapper();ClarificationStore store=new ClarificationStore(refinements,questions,mapper);
 Finding finding(){String text="필요 시 재할당한다.";return new Finding("동작 조건 불명확",text,"조건을 모름","조건 질문",null,"ADVISORY",List.of(),null,null,0,text.length(),"언제 재할당하나요?",List.of());}
 ClarificationQuestion question()throws Exception{var f=finding();return new ClarificationQuestion(77L,ReviewAnalysisStore.hash(f.findingType()+":"+f.targetSpan()+":"+f.reason()),mapper.writeValueAsString(f));}
 @Test void deferSurvivesAnotherReviewOfUnchangedIssue()throws Exception{var q=question();q.defer("고객 협의 예정",7L);when(questions.findByRequirementIdOrderByIdAsc(77L)).thenReturn(List.of(q));store.reconcile(77L,finding().targetSpan(),List.of(finding()),"COMPLETE",0,"COMPLETE","g");assertEquals("DEFERRED",q.getStatus());assertEquals("고객 협의 예정",q.getNote());verify(questions).save(q);}
 @Test void resolvedIssueLeavesActiveQuestionList()throws Exception{var q=question();q.defer("나중에",7L);when(questions.findByRequirementIdOrderByIdAsc(77L)).thenReturn(List.of(q));store.reconcile(77L,"장애가 발생하면 재할당한다.",List.of(),"COMPLETE",0,"COMPLETE","g");assertEquals("SUPERSEDED",q.getStatus());}
 @Test void answeredQuestionIsRetainedAsHistory()throws Exception{var q=question();q.answer("장애 시","장애가 발생하면 재할당한다.",7L);when(questions.findByRequirementIdOrderByIdAsc(77L)).thenReturn(List.of(q));store.reconcile(77L,"장애가 발생하면 재할당한다.",List.of(),"COMPLETE",0,"COMPLETE","g");assertEquals("ANSWERED",q.getStatus());assertEquals("장애 시",q.getAnswer());}
 @Test void manualReversionCanCreateNewQuestionWithoutErasingPastAnswer()throws Exception{var q=question();q.answer("장애 시","장애가 발생하면 재할당한다.",7L);when(questions.findByRequirementIdOrderByIdAsc(77L)).thenReturn(List.of(q));store.reconcile(77L,finding().targetSpan(),List.of(finding()),"RULE_ONLY",0,"RULE_ONLY","g");var cap=org.mockito.ArgumentCaptor.forClass(ClarificationQuestion.class);verify(questions).save(cap.capture());assertNotSame(q,cap.getValue());assertEquals("OPEN",cap.getValue().getStatus());assertEquals("ANSWERED",q.getStatus());}
}
