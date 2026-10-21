package com.semes.reqops.domain.knowledge;
import com.semes.reqops.domain.requirement.service.ReviewAnalysisStore;
import com.semes.reqops.global.ai.*;
import lombok.RequiredArgsConstructor;import org.springframework.stereotype.Service;
@Service @RequiredArgsConstructor
public class RequirementReviewRunner {
 private final ReviewAnalysisStore store;private final GlossaryService glossary;private final AiClient ai;
 public void run(Long project,Long req,String content,String base,String reason,boolean initialOnly){
  var existing=store.existing(project,req);var terms=glossary.forAnalysis(project);
  var response=ai.analyzeWithGlossary(content,base,reason,existing,terms);
  store.save(req,content,response,existing,initialOnly,glossary.hash(terms));
 }
}
