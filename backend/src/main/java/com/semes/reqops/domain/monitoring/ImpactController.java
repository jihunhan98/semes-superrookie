package com.semes.reqops.domain.monitoring;
import jakarta.validation.Valid;import jakarta.validation.constraints.NotNull;import lombok.RequiredArgsConstructor;import org.springframework.web.bind.annotation.*;import java.util.List;
@RestController @RequiredArgsConstructor @RequestMapping("/api/v2/projects/{projectId}/impact-events")
public class ImpactController {
 private final ImpactService service;
 public record ReadRequest(@NotNull Long userId){}
 @GetMapping public List<ImpactService.View> list(@PathVariable Long projectId,@RequestParam Long userId,@RequestParam(required=false) Long requirementId,@RequestParam(defaultValue="false") boolean includeRead){return service.list(projectId,userId,requirementId,includeRead);}
 @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT) @PostMapping("/{eventId}/read") public void read(@PathVariable Long projectId,@PathVariable Long eventId,@Valid @RequestBody ReadRequest req){service.read(projectId,eventId,req.userId());}
}
