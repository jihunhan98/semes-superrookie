package com.semes.reqops.domain.knowledge;
import jakarta.validation.Valid;import lombok.RequiredArgsConstructor;import org.springframework.web.bind.annotation.*;import java.util.Map;
import static com.semes.reqops.domain.knowledge.KnowledgeDto.*;
@RestController @RequestMapping("/api/projects/{projectId}") @RequiredArgsConstructor
public class KnowledgeController {
 private final GlossaryService glossary;private final ClarificationService clarifications;
 @GetMapping("/glossary") public GlossaryView glossary(@PathVariable Long projectId,@RequestParam Long userId){return glossary.list(projectId,userId);}
 @GetMapping("/glossary/summary") public Map<String,Long> summary(@PathVariable Long projectId,@RequestParam Long userId){glossary.requireMember(projectId,userId);return Map.of("pendingCount",glossary.pending(projectId));}
 @PatchMapping("/glossary/{termId}") public GlossaryView review(@PathVariable Long projectId,@PathVariable Long termId,@Valid @RequestBody TermReview request){return glossary.review(projectId,termId,request);}
 @GetMapping("/requirements/{requirementId}/refinement") public RefinementView refinement(@PathVariable Long projectId,@PathVariable Long requirementId,@RequestParam Long userId){return clarifications.get(projectId,requirementId,userId);}
 @PostMapping("/requirements/{requirementId}/clarifications/{questionId}/answer") public RefinementView answer(@PathVariable Long projectId,@PathVariable Long requirementId,@PathVariable Long questionId,@Valid @RequestBody AnswerRequest input){return clarifications.answer(projectId,requirementId,questionId,input);}
 @PostMapping("/requirements/{requirementId}/clarifications/{questionId}/defer") public RefinementView defer(@PathVariable Long projectId,@PathVariable Long requirementId,@PathVariable Long questionId,@Valid @RequestBody DeferRequest input){return clarifications.defer(projectId,requirementId,questionId,input);}
}
