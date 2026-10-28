package com.semes.reqops.domain.assistant;

import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.requirement.service.RequirementService;
import com.semes.reqops.global.ai.AiClient;
import com.semes.reqops.global.exception.ApiErrors;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/projects/{projectId}/assistant")
@RequiredArgsConstructor
public class AssistantController {
 private final MembershipRepository members;
 private final RequirementRepository requirements;
 private final RequirementService service;
 private final AiClient ai;
 private final com.semes.reqops.domain.issue.service.DevIssueService issueService;
 public record Message(@NotBlank @Pattern(regexp="user|assistant") String role,@NotBlank @Size(max=12000) String content) {}
 public record Input(@NotNull Long userId,@NotBlank @Pattern(regexp="project|requirements|edit|artifacts") String page,
   Long requirementId,@Size(max=100000) String draft,@NotBlank @Size(max=4000) String message,
   @Size(max=12) List<@Valid Message> history) {}
 @PostMapping public Map<String,Object> chat(@PathVariable Long projectId,@Valid @RequestBody Input input){
  if(!members.existsByUserIdAndProjectId(input.userId(),projectId))throw new ApiErrors.NotProjectMember();
  var context=new LinkedHashMap<String,Object>();
  context.put("requirements",service.list(projectId,input.userId()).stream().map(r->Map.of("key",r.reqKey(),"content",r.content(),"state",r.state())).toList());
  if(input.requirementId()!=null){
   requirements.findById(input.requirementId()).filter(r->r.getProjectId().equals(projectId)).orElseThrow(()->new ApiErrors.RequirementNotFound(input.requirementId()));
   var detail=service.detail(projectId,input.requirementId(),input.userId());
   if("artifacts".equals(input.page()))context.put("issues",issueService.list(projectId,input.requirementId(),input.userId()));
   context.put("requirement",Map.of("key",detail.reqKey(),"content",detail.content(),"state",detail.state(),"findings",detail.findings()));
  }
  if(input.draft()!=null)context.put("editingContent",input.draft());
  return ai.insight("/assistant",Map.of("page",input.page(),"context",context,"message",input.message(),"history",input.history()==null?List.of():input.history()));
 }
}
