package com.semes.reqops.domain.artifact.controller;

import com.semes.reqops.domain.artifact.service.ArtifactReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/projects/{projectId}/artifact-review")
public class ArtifactReviewController {
    private final ArtifactReviewService service;
    @GetMapping("/coverage/{reqId}")
    public Map<String,Object> coverage(@PathVariable Long projectId, @PathVariable Long reqId, @RequestParam Long userId) { return service.latestCoverage(projectId,reqId,userId); }
    @PostMapping("/coverage/{reqId}")
    public Map<String,Object> check(@PathVariable Long projectId, @PathVariable Long reqId, @RequestParam Long userId) { return service.coverage(projectId,reqId,userId); }
}
