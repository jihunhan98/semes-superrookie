package com.semes.reqops.domain.workflow.controller;

import com.semes.reqops.domain.workflow.dto.BundleDto.*;
import com.semes.reqops.domain.workflow.service.BundleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/v2/projects/{projectId}/requirements/{requirementId}/bundle")
public class BundleController {
    private final BundleService service;
    @GetMapping public BundleResponse current(@PathVariable Long projectId,@PathVariable Long requirementId,@RequestParam Long userId){return service.current(projectId,requirementId,userId);}
    @PostMapping("/confirm") public BundleResponse confirm(@PathVariable Long projectId,@PathVariable Long requirementId,@Valid @RequestBody ConfirmRequest request){return service.confirm(projectId,requirementId,request);}
}
