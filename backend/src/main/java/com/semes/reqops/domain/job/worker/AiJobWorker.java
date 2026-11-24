package com.semes.reqops.domain.job.worker;
import com.fasterxml.jackson.databind.*; import com.semes.reqops.domain.artifact.dto.ArtifactDto.RegenerateRequest; import com.semes.reqops.domain.artifact.service.ArtifactService; import com.semes.reqops.domain.job.entity.AiTask; import com.semes.reqops.domain.job.service.AiJobService; import com.semes.reqops.domain.requirement.entity.*; import com.semes.reqops.domain.requirement.repository.*; import com.semes.reqops.global.ai.*; import lombok.RequiredArgsConstructor; import org.springframework.scheduling.annotation.Scheduled; import org.springframework.stereotype.Component; import java.util.*;
@Component @RequiredArgsConstructor
public class AiJobWorker {
 private final com.semes.reqops.domain.knowledge.RequirementReviewRunner reviewRunner;
 private final AiJobService jobs; private final ArtifactService artifacts; private final ObjectMapper mapper; private final AiClient aiClient; private final RequirementRepository requirements; private final RequirementFindingRepository findings; private final RequirementAiDraftRepository drafts; private final com.semes.reqops.domain.workflow.repository.WorkBundleRepository bundles;
 @Scheduled(fixedDelayString="${app.ai.worker-delay-ms:1000}") public void runOne(){jobs.recoverExpired();AiTask task=jobs.claim("local-worker");if(task==null)return;try{Map<?,?> in=mapper.readValue(task.getInputJson(),Map.class);if("analyze".equals(in.get("operation")))analyze(in);else if(in.containsKey("issueKey") && in.containsKey("type")){
  var job=jobs.get(task.getJobId());var current=bundles.findFirstByRequirementIdAndCurrentOrderByRevisionNoDesc(n(in,"requirementId"),1);
  if(current.isEmpty()||!current.get().getId().equals(job.getBundleId())){jobs.succeeded(task.getId(),"{\"status\":\"superseded\"}");return;}
  artifacts.regenerate(n(in,"projectId"),n(in,"requirementId"),(String)in.get("issueKey"),(String)in.get("type"),new RegenerateRequest(n(in,"userId"),(String)in.get("reason")));
 }else {jobs.succeeded(task.getId(),"{\"status\":\"ignored\"}");return;}jobs.succeeded(task.getId(),"{\"status\":\"ok\"}");}catch(Exception e){jobs.failed(task.getId(),"AI_TASK_FAILED",e.getMessage()==null?e.getClass().getSimpleName():e.getMessage());}}
 private void analyze(Map<?,?> in) {
  Long project=n(in,"projectId"), requirement=n(in,"requirementId");
  String content=(String)in.get("content");
  reviewRunner.run(project, requirement, content, null, null, true);
 }

 private Long n(Map<?,?> m,String k){return ((Number)m.get(k)).longValue();}
}
