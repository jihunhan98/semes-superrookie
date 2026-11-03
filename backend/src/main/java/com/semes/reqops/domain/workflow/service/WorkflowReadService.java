package com.semes.reqops.domain.workflow.service;

import com.semes.reqops.domain.artifact.repository.DevIssueArtifactRepository;
import com.semes.reqops.domain.issue.repository.DevIssueRepository;
import com.semes.reqops.domain.requirement.entity.Requirement;
import com.semes.reqops.domain.requirement.repository.RequirementVersionRepository;
import com.semes.reqops.domain.workflow.entity.WorkBundle;
import com.semes.reqops.domain.workflow.repository.WorkBundleRepository;
import com.semes.reqops.domain.workflow.dto.BundleDto.ArtifactSummary;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.stream.Collectors;

/** Same persisted workflow state for list, detail and the deliverables index. */
@Service @RequiredArgsConstructor
public class WorkflowReadService {
 private final WorkBundleRepository bundles;
 private final RequirementVersionRepository versions;
 private final DevIssueRepository issues;
 private final DevIssueArtifactRepository artifacts;
 public record Progress(int step,String label,String bundleState,int issueCount,int artifactCount,int expectedArtifactCount) {}
 public record IssueRow(Long id,String issueKey,String title,String state,List<ArtifactSummary> artifacts) {}
 public record Snapshot(Progress progress,List<IssueRow> issues) {}
 public Map<Long,Snapshot> load(List<Requirement> requirements) {
  if(requirements.isEmpty()) return Map.of();
  var ids=requirements.stream().map(Requirement::getId).toList();
  Map<Long,WorkBundle> current=new HashMap<>();
  for(var b:bundles.findByRequirementIdInAndCurrentOrderByRevisionNoDesc(ids,1)) current.putIfAbsent(b.getRequirementId(),b);
  var versionIds=current.values().stream().map(WorkBundle::getRequirementVersionId).filter(Objects::nonNull).distinct().toList();
  var versionMap=versions.findAllById(versionIds).stream().collect(Collectors.toMap(v->v.getId(),v->v));
  var active=issues.findByRequirementIdInAndIssueStateNotOrderByDisplayOrderAsc(ids,"RETIRED");
  var issueIds=active.stream().map(i->i.getId()).toList();
  var docs=issueIds.isEmpty()?Map.<Long,List<com.semes.reqops.domain.artifact.entity.DevIssueArtifact>>of():artifacts.findByDevIssueIdInOrderByArtifactTypeAsc(issueIds).stream().collect(Collectors.groupingBy(a->a.getDevIssueId()));
  Map<Long,Snapshot> result=new HashMap<>();
  for(var req:requirements) {
   WorkBundle b=current.get(req.getId());
   var version=b==null?null:versionMap.get(b.getRequirementVersionId());
   boolean matches=b!=null&&version!=null&&Objects.equals(version.getRequirementId(),req.getId())&&Objects.equals(version.getVersion(),req.getVersion());
   var rows=active.stream().filter(i->matches&&i.getRequirementId().equals(req.getId())&&(i.getBundleId()==null||Objects.equals(i.getBundleId(),b.getId())))
    .map(i->new IssueRow(i.getId(),i.getIssueKey(),i.getTitle(),i.getIssueState(),docs.getOrDefault(i.getId(),List.of()).stream().map(a->new ArtifactSummary(a.getId(),a.getArtifactType().slug(),a.getState().name(),a.getSchemaVersion(),a.getRowVersion())).toList())).toList();
   String state=matches?b.getState().name():null;
   int count=rows.stream().mapToInt(i->i.artifacts().size()).sum();
   result.put(req.getId(),new Snapshot(progress(req.getState().name(),state,rows.size(),count),rows));
  }
  return result;
 }
 public static Progress progress(String requirementState,String bundleState,int issueCount,int artifactCount) {
  int step;String label;
  if(!"CONFIRMED".equals(requirementState)){step="RECEIVED".equals(requirementState)?1:2;label=step==1?"등록":"검출·합의";}
  else if("CONFIRMED".equals(bundleState)){step=4;label="확정 완료";}
  else if("REVIEW".equals(bundleState)){step=4;label="산출물 검토";}
  else {step=3;label="GENERATING".equals(bundleState)?"산출물 생성 중":"ISSUES_READY".equals(bundleState)?"개발 이슈 도출 완료":"도출 준비";}
  return new Progress(step,label,bundleState,issueCount,artifactCount,issueCount*4);
 }
}
