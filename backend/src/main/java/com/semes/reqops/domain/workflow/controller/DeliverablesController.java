package com.semes.reqops.domain.workflow.controller;
import com.semes.reqops.domain.workflow.service.WorkflowReadService;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequiredArgsConstructor
@RequestMapping("/api/v2/projects/{projectId}/deliverables")
public class DeliverablesController {
 private final RequirementRepository requirements;private final MembershipRepository memberships;private final WorkflowReadService workflow;
 public record Group(Long requirementId,String reqKey,String content,String version,String state,WorkflowReadService.Progress workflow,List<WorkflowReadService.IssueRow> issues) {}
 @GetMapping @Transactional(readOnly=true)
 public List<Group> list(@PathVariable Long projectId,@RequestParam Long userId){
  memberships.findByUserIdAndProjectId(userId,projectId).orElseThrow(ApiErrors.NotProjectMember::new);
  var rows=requirements.findByProjectIdOrderByCreatedAtDesc(projectId);var loaded=workflow.load(rows);
  return rows.stream().filter(r->!loaded.get(r.getId()).issues().isEmpty()).map(r->new Group(r.getId(),r.getReqKey(),r.getContent(),r.getVersion(),r.getState().name(),loaded.get(r.getId()).progress(),loaded.get(r.getId()).issues())).toList();
 }
}
