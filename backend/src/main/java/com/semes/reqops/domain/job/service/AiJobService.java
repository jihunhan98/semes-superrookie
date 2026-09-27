package com.semes.reqops.domain.job.service;
import com.fasterxml.jackson.databind.ObjectMapper; import com.semes.reqops.domain.issue.dto.IssueDto.IssueResponse; import com.semes.reqops.domain.job.entity.*; import com.semes.reqops.domain.job.repository.*; import com.semes.reqops.domain.workflow.repository.WorkBundleRepository; import lombok.RequiredArgsConstructor; import org.springframework.stereotype.Service; import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets; import java.security.MessageDigest; import java.time.LocalDateTime; import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;

@Service @RequiredArgsConstructor
public class AiJobService {
 private final AiJobRepository jobs; private final AiTaskRepository tasks; private final WorkBundleRepository bundles; private final ObjectMapper mapper;
 private final JdbcTemplate jdbc;
 @Transactional public AiJob enqueueGeneration(Long projectId,Long requirementId,Long userId,List<IssueResponse> issues){
  String key="generate-"+requirementId+"-"+issues.stream().map(IssueResponse::id).toList().hashCode(); Optional<AiJob> old=jobs.findByProjectIdAndIdempotencyKey(projectId,key);if(old.isPresent())return old.get();
  Long bundleId=bundles.findFirstByRequirementIdAndCurrentOrderByRevisionNoDesc(requirementId,1).map(b->{b.generating();bundles.save(b);return b.getId();}).orElse(null);
  AiJob job=jobs.save(new AiJob(projectId,requirementId,bundleId,"GENERATE",key,hash(key),userId,issues.size()*4));
  for(IssueResponse issue:issues) for(String type:List.of("voc","functional","nonfunctional","detail-design")) try{tasks.save(new AiTask(job.getId(),issue.id()+":"+type,"BATCH",mapper.writeValueAsString(Map.of("projectId",projectId,"requirementId",requirementId,"issueKey",issue.issueKey(),"type",type,"userId",userId))));}catch(Exception e){throw new IllegalStateException(e);} return job;
 }
 @Transactional public AiJob enqueueAnalysis(Long projectId,Long requirementId,Long userId,String content){
  String key="analyze-"+requirementId+"-"+hash(content).substring(0,12);Optional<AiJob> old=jobs.findByProjectIdAndIdempotencyKey(projectId,key);if(old.isPresent())return old.get();
  AiJob job=jobs.save(new AiJob(projectId,requirementId,null,"ANALYZE",key,hash(content),userId,1));
  try{tasks.save(new AiTask(job.getId(),"analyze:"+requirementId,"DETECT",mapper.writeValueAsString(Map.of("operation","analyze","projectId",projectId,"requirementId",requirementId,"content",content,"userId",userId))));}catch(Exception e){throw new IllegalStateException(e);}return job;
 }
 @Transactional public AiTask claim(String worker){
  List<Long> ids=jdbc.query(connection->{var statement=connection.prepareStatement("SELECT id FROM ai_tasks WHERE status IN ('QUEUED','RETRY_WAIT') AND next_run_at <= SYSTIMESTAMP ORDER BY id FOR UPDATE SKIP LOCKED");statement.setMaxRows(1);return statement;},(rs,row)->rs.getLong(1));
  if(ids.isEmpty())return null;AiTask t=tasks.findById(ids.get(0)).orElseThrow();t.claim(worker,UUID.randomUUID().toString());return tasks.save(t);
 }
 @Transactional public void recoverExpired(){List<AiTask> expired=tasks.findByStatusAndLeaseUntilBefore("RUNNING",LocalDateTime.now());expired.forEach(AiTask::recoverExpired);tasks.saveAll(expired);}
 @Transactional public void succeeded(Long taskId,String result){AiTask t=tasks.findById(taskId).orElseThrow();t.succeed(result);tasks.save(t);refresh(t.getJobId());}
 @Transactional public void failed(Long taskId,String code,String message){AiTask t=tasks.findById(taskId).orElseThrow();t.fail(code,message);tasks.save(t);refresh(t.getJobId());}
 @Transactional(readOnly=true) public AiJob get(Long id){return jobs.findById(id).orElseThrow();}
 @Transactional public AiJob retryFailed(Long id,Long userId){AiJob job=jobs.findById(id).orElseThrow();if(userId==null||!job.getRequestedBy().equals(userId))throw new com.semes.reqops.global.exception.ApiErrors.Forbidden("작업 요청자만 재시도할 수 있습니다.");List<AiTask> failed=tasks.findByJobIdAndStatus(id,"FAILED");failed.forEach(AiTask::manualRetry);tasks.saveAll(failed);job.progress(tasks.countByJobIdAndStatus(id,"SUCCEEDED"),0);return jobs.save(job);}
 private void refresh(Long jobId){AiJob j=jobs.findById(jobId).orElseThrow();int ok=tasks.countByJobIdAndStatus(jobId,"SUCCEEDED"),fail=tasks.countByJobIdAndStatus(jobId,"FAILED");j.progress(ok,fail);jobs.save(j);if(ok+fail>=j.getTotalCount()&&j.getBundleId()!=null)bundles.findById(j.getBundleId()).ifPresent(b->{b.review();bundles.save(b);});}
 private String hash(String s){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
}
