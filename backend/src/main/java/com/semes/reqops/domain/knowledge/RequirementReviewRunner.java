package com.semes.reqops.domain.knowledge;
import com.semes.reqops.domain.requirement.service.ReviewAnalysisStore;
import com.semes.reqops.global.ai.*;
import lombok.RequiredArgsConstructor;import org.springframework.stereotype.Service;
@Service @RequiredArgsConstructor
public class RequirementReviewRunner {
 private final ReviewAnalysisStore store;private final GlossaryService glossary;private final AiClient ai;
 private final com.semes.reqops.domain.project.repository.ProjectRepository projects;
 public void run(Long project,Long req,String content,String base,String reason,boolean initialOnly){
  var existing=store.existing(project,req);var terms=glossary.forAnalysis(project);
  var projectInfo=projects.findById(project).orElseThrow(()->new IllegalStateException("프로젝트를 찾지 못했습니다."));
  var response=ai.analyzeWithGlossary(content,base,reason,existing,terms,new AiAnalyzeDto.ProjectContext(projectInfo.getName(),projectInfo.getDescription()));
  store.save(req,content,response,existing,initialOnly,glossary.hash(terms));
 }
}
