package com.semes.reqops.domain.knowledge;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.requirement.entity.Requirement;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.global.ai.*;import com.semes.reqops.global.exception.ApiErrors;
import org.junit.jupiter.api.*;import org.springframework.test.util.ReflectionTestUtils;import java.util.*;
import static org.junit.jupiter.api.Assertions.*;import static org.mockito.Mockito.*;
class ClarificationServiceTest {
 static <T>T stub(Class<T> type){return mock(type,withSettings().mockMaker("mock-maker-subclass"));}
 GlossaryService glossary=stub(GlossaryService.class);RequirementRepository requirements=stub(RequirementRepository.class);
 RequirementRefinementRepository refinements=stub(RequirementRefinementRepository.class);ClarificationQuestionRepository questions=stub(ClarificationQuestionRepository.class);
 RequirementReviewRunner runner=stub(RequirementReviewRunner.class);AiClient ai=stub(AiClient.class);
 ClarificationStore store=new ClarificationStore(refinements,questions,new ObjectMapper());ClarificationService service=new ClarificationService(glossary,requirements,refinements,questions,store,runner,ai);
 String before="필요 시 재할당한다.",full="앞 문장.\n"+before+"\n뒤 문장.";
 RequirementRefinement current=new RequirementRefinement(77L,full);ClarificationQuestion q;
 @BeforeEach void setup()throws Exception{
  Requirement requirement=new Requirement(1L,"REQ-77",full,null,null,7L);ReflectionTestUtils.setField(requirement,"id",77L);
  when(requirements.findById(77L)).thenReturn(Optional.of(requirement));when(requirements.findLockedById(77L)).thenReturn(Optional.of(requirement));
  current.analyzed(full,"READY",0,"COMPLETE","g");when(refinements.findById(77L)).thenReturn(Optional.of(current));
  when(glossary.forAnalysis(1L)).thenReturn(List.of());when(glossary.hash(List.of())).thenReturn("g");
  var f=new AiAnalyzeDto.Finding("동작 조건 불명확",before,"조건 질문","질문",null,"ADVISORY",List.of(),null,null,6,6+before.length(),"언제 재할당하나요?",List.of());
  q=new ClarificationQuestion(77L,"fingerprint",new ObjectMapper().writeValueAsString(f));ReflectionTestUtils.setField(q,"id",9L);
  when(questions.findById(9L)).thenReturn(Optional.of(q));when(questions.findByRequirementIdOrderByIdAsc(77L)).thenReturn(List.of(q));
 }
 @Test void deferredQuestionDoesNotChangeBodyOrCallAi(){var view=service.defer(1L,77L,9L,new KnowledgeDto.DeferRequest(7L,current.getRevision(),"고객 협의 예정"));assertEquals(full,view.content());assertEquals("DEFERRED",q.getStatus());assertEquals("고객 협의 예정",q.getNote());verifyNoInteractions(ai,runner);}
 @Test void staleRevisionCannotApplyAnswer(){assertThrows(ApiErrors.Conflict.class,()->service.answer(1L,77L,9L,new KnowledgeDto.AnswerRequest(7L,0L,"장애 시")));verifyNoInteractions(ai,runner);}
 @Test void changedDefinitionRequiresFreshReview(){when(glossary.hash(List.of())).thenReturn("changed");assertThrows(ApiErrors.Conflict.class,()->service.answer(1L,77L,9L,new KnowledgeDto.AnswerRequest(7L,current.getRevision(),"장애 시")));verifyNoInteractions(ai,runner);}
 @Test void answerRewritesOnlySelectedSentenceAndPreservesHistory(){
  when(ai.insight(eq("/clarify-answer"),anyMap())).thenReturn(Map.of("replacement","장애가 발생하면 재할당한다."));
  doAnswer(inv->{current.analyzed(inv.getArgument(2),"READY",0,"COMPLETE","g");return null;}).when(runner).run(any(),any(),anyString(),anyString(),anyString(),anyBoolean());
  var view=service.answer(1L,77L,9L,new KnowledgeDto.AnswerRequest(7L,current.getRevision(),"장애 시"));
  assertEquals("앞 문장.\n장애가 발생하면 재할당한다.\n뒤 문장.",view.content());assertEquals("ANSWERED",q.getStatus());assertEquals("장애 시",q.getAnswer());verify(questions).save(q);
 }
 @Test void outdatedSourcePositionIsRejected(){current.analyzed("사용자가 직접 수정한 문장","READY",0,"COMPLETE","g");assertThrows(ApiErrors.Conflict.class,()->service.answer(1L,77L,9L,new KnowledgeDto.AnswerRequest(7L,current.getRevision(),"장애 시")));verifyNoInteractions(ai,runner);}
 @Test void questionOfAnotherRequirementCannotBeAnswered(){ReflectionTestUtils.setField(q,"requirementId",88L);assertThrows(ApiErrors.Conflict.class,()->service.answer(1L,77L,9L,new KnowledgeDto.AnswerRequest(7L,current.getRevision(),"장애 시")));verifyNoInteractions(ai,runner);}
 @Test void failedAiDoesNotMarkAnswerAsApplied(){when(ai.insight(anyString(),anyMap())).thenThrow(new ApiErrors.Conflict("AI 연결 실패"));assertThrows(ApiErrors.Conflict.class,()->service.answer(1L,77L,9L,new KnowledgeDto.AnswerRequest(7L,current.getRevision(),"장애 시")));assertEquals("OPEN",q.getStatus());assertEquals(full,current.getContent());verifyNoInteractions(runner);}
}
