package com.semes.reqops.domain.insight;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequiredArgsConstructor @RequestMapping("/api/projects/{projectId}/insights")
public class InsightController {
    private final InsightService service;
    @GetMapping("/impacts") public List<Map<String,Object>> impacts(@PathVariable Long projectId,@RequestParam Long userId){return service.impacts(projectId,userId);}
    @PostMapping("/impacts/{jobId}/read") public void read(@PathVariable Long projectId,@PathVariable Long jobId,@RequestParam Long userId){service.markRead(projectId,jobId,userId);}
    @PostMapping("/impacts/{jobId}/retry") public void retry(@PathVariable Long projectId,@PathVariable Long jobId,@RequestParam Long userId){service.retry(projectId,jobId,userId);}
    @GetMapping("/code") public Map<String,Object> code(@PathVariable Long projectId,@RequestParam Long userId){service.member(projectId,userId);return service.code(projectId);}
    @PostMapping("/code") public Map<String,Object> code(@PathVariable Long projectId,@RequestParam Long userId,@RequestBody Map<String,Object> input){return service.registerCode(projectId,userId,input);}
    @GetMapping("/coverage/{reqId}") public Map<String,Object> coverage(@PathVariable Long projectId,@PathVariable Long reqId,@RequestParam Long userId){return service.latestCoverage(projectId,reqId,userId);}
    @PostMapping("/coverage/{reqId}") public Map<String,Object> check(@PathVariable Long projectId,@PathVariable Long reqId,@RequestParam Long userId){return service.coverage(projectId,reqId,userId);}
}
