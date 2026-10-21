package com.semes.reqops.domain.knowledge;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.requirement.service.ReviewAnalysisStore;
import com.semes.reqops.global.ai.AiAnalyzeDto.*;
import lombok.RequiredArgsConstructor;import org.springframework.stereotype.Service;
import java.util.*;
@Service @RequiredArgsConstructor
public class ClarificationStore {
 private final RequirementRefinementRepository refinements;
 private final ClarificationQuestionRepository questions;
 private final ObjectMapper mapper;
 public long openCount(Long req){return questions.findByRequirementIdOrderByIdAsc(req).stream().filter(q->"OPEN".equals(q.getStatus())).count();}
 public Finding data(ClarificationQuestion q){try{return mapper.readValue(q.getData(),Finding.class);}catch(Exception e){throw new IllegalStateException("질문 데이터를 읽지 못했습니다.",e);}}
 public String json(Object value){try{return mapper.writeValueAsString(value);}catch(Exception e){throw new IllegalStateException(e);}}
 public void reconcile(Long req,String content,List<Finding> findings,String status,int newTerms,String termStatus,String glossaryHash){
  RequirementRefinement refinement=refinements.findById(req).orElseGet(()->new RequirementRefinement(req,content));
  List<ClarificationQuestion> old=questions.findByRequirementIdOrderByIdAsc(req);
  Set<String> fingerprints=new HashSet<>();
  for(Finding finding:findings){
   String fingerprint=ReviewAnalysisStore.hash(finding.findingType()+":"+finding.targetSpan()+":"+finding.reason());
   if(!fingerprints.add(fingerprint))continue;
   Finding usable=finding;
   if(usable.questionText()==null||usable.questionText().isBlank())usable=new Finding(finding.findingType(),finding.targetSpan(),finding.reason(),finding.suggestion(),finding.conflictReqKey(),finding.severity(),finding.proposals(),finding.interpretations(),finding.conflictQuote(),finding.spanStart(),finding.spanEnd(),"이 동작의 구체적인 기준이나 조건을 알려주시겠어요?",List.of());
   ClarificationQuestion existing=old.stream().filter(q->q.getFingerprint().equals(fingerprint)&&List.of("OPEN","DEFERRED").contains(q.getStatus())).findFirst().orElse(null);
   if(existing==null)questions.save(new ClarificationQuestion(req,fingerprint,json(usable)));
   else{existing.refresh(json(usable));questions.save(existing);}
  }
  for(ClarificationQuestion q:old)if(List.of("OPEN","DEFERRED").contains(q.getStatus())&&!fingerprints.contains(q.getFingerprint())){q.supersede();questions.save(q);}
  String viewStatus=List.of("COMPLETE","RULE_ONLY").contains(status)?"READY":status;
  refinement.analyzed(content,viewStatus,newTerms,termStatus==null?"RULE_ONLY":termStatus,glossaryHash);
  refinements.saveAndFlush(refinement);
 }
}
