package com.semes.reqops.domain.knowledge;
import com.semes.reqops.domain.requirement.repository.*;
import com.semes.reqops.global.ai.AiClient;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import static com.semes.reqops.domain.knowledge.KnowledgeDto.*;
@Service @RequiredArgsConstructor
public class ClarificationService {
 private final GlossaryService glossary;private final RequirementRepository requirements;
 private final RequirementRefinementRepository refinements;private final ClarificationQuestionRepository questions;
 private final ClarificationStore store;private final RequirementReviewRunner runner;private final AiClient ai;
 private void access(Long project,Long req,Long user){glossary.requireMember(project,user);requirements.findById(req).filter(r->r.getProjectId().equals(project)).orElseThrow(()->new ApiErrors.RequirementNotFound(req));}
 @Transactional(readOnly=true)
 public RefinementView get(Long project,Long req,Long user){
  access(project,req,user);var refinement=refinements.findById(req).orElse(null);
  if(refinement==null)return new RefinementView(false,0,requirements.findById(req).orElseThrow().getContent(),"ANALYZING",List.of(),glossary.pending(project),0,"RULE_ONLY",false);
  List<QuestionView> views=questions.findByRequirementIdOrderByIdAsc(req).stream().filter(q->!"SUPERSEDED".equals(q.getStatus())).map(q->{var data=store.data(q);return new QuestionView(q.getId(),data.findingType(),data.questionText(),data.targetSpan(),data.options()==null?List.of():data.options(),q.getStatus(),q.getAnswer(),q.getReplacement(),q.getNote());}).toList();
  boolean dictionaryChanged=!Objects.equals(refinement.getGlossaryHash(),glossary.hash(glossary.forAnalysis(project)));
  return new RefinementView(true,refinement.getRevision(),refinement.getContent(),refinement.getStatus(),views,glossary.pending(project),refinement.getNewTermCount(),refinement.getTermStatus(),dictionaryChanged);
 }
 private RequirementRefinement lock(Long project,Long req,Long user,long revision){
  access(project,req,user);requirements.findLockedById(req).orElseThrow();
  RequirementRefinement current=refinements.findById(req).orElseThrow(()->new ApiErrors.Conflict("등록 검토가 아직 준비되지 않았습니다."));
  if(current.getRevision()!=revision)throw new ApiErrors.Conflict("다른 창에서 본문이나 질문이 바뀌었습니다. 새로고침 후 다시 답변해주세요.");
  if(!Objects.equals(current.getGlossaryHash(),glossary.hash(glossary.forAnalysis(project))))throw new ApiErrors.Conflict("용어 정의가 바뀌었습니다. 먼저 다시 검토해주세요.");
  return current;
 }
 private ClarificationQuestion question(Long req,Long id){return questions.findById(id).filter(q->q.getRequirementId().equals(req)&&List.of("OPEN","DEFERRED").contains(q.getStatus())).orElseThrow(()->new ApiErrors.Conflict("현재 답변할 수 없는 질문입니다. 질문 목록을 새로 확인해주세요."));}
 @Transactional
 public RefinementView defer(Long project,Long req,Long id,DeferRequest input){
  var current=lock(project,req,input.userId(),input.revision());var q=question(req,id);
  q.defer(input.note(),input.userId());questions.save(q);current.touched();refinements.saveAndFlush(current);
  return get(project,req,input.userId());
 }
 @Transactional
 public RefinementView answer(Long project,Long req,Long id,AnswerRequest input){
  var current=lock(project,req,input.userId(),input.revision());var q=question(req,id);var data=store.data(q);
  int start=data.spanStart()==null?-1:data.spanStart(),end=data.spanEnd()==null?-1:data.spanEnd();
  if(start<0||end<start||end>current.getContent().length()||!current.getContent().substring(start,end).equals(data.targetSpan()))throw new ApiErrors.Conflict("질문 대상 문장이 바뀌었습니다. 먼저 다시 검토해주세요.");
  var response=ai.insight("/clarify-answer",Map.of("content",current.getContent(),"targetSpan",data.targetSpan(),"question",data.questionText(),"answer",input.answer().trim(),"proposals",data.proposals()==null?List.of():data.proposals(),"glossary",glossary.forAnalysis(project)));
  Object value=response.get("replacement");
  if(!(value instanceof String replacement)||replacement.isBlank()||replacement.length()>12000||replacement.equals(data.targetSpan())||replacement.contains("⟦")||replacement.contains("⟧"))throw new ApiErrors.Conflict("답변을 반영한 문장을 확인하지 못했습니다. 답변을 조금 더 구체적으로 입력해주세요.");
  String content=current.getContent().substring(0,start)+(String)value+current.getContent().substring(end);
  q.answer(input.answer().trim(),(String)value,input.userId());questions.save(q);
  runner.run(project,req,content,requirements.findById(req).orElseThrow().getContent(),"사용자 질문 답변 반영",false);
  return get(project,req,input.userId());
 }
}
