package com.semes.reqops.domain.project.controller;

import com.semes.reqops.domain.project.dto.ProjectDto.CreateRequest;
import com.semes.reqops.domain.project.dto.ProjectDto.DetailResponse;
import com.semes.reqops.domain.project.dto.ProjectDto.JoinRequest;
import com.semes.reqops.domain.project.dto.ProjectDto.SummaryResponse;
import com.semes.reqops.domain.project.dto.ProjectDto.TokenResponse;
import com.semes.reqops.domain.project.dto.ProjectDto.UpdateRequest;
import com.semes.reqops.domain.project.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DetailResponse create(@Valid @RequestBody CreateRequest request) {
        return projectService.create(request);
    }

    @GetMapping
    public List<SummaryResponse> list(@RequestParam Long userId) {
        return projectService.list(userId);
    }

    @PostMapping("/join")
    public SummaryResponse join(@Valid @RequestBody JoinRequest request) {
        return projectService.join(request);
    }

    @GetMapping("/{id}")
    public DetailResponse detail(@PathVariable Long id, @RequestParam Long userId) {
        return projectService.detail(id, userId);
    }

    @PatchMapping("/{id}")
    public DetailResponse update(@PathVariable Long id, @Valid @RequestBody UpdateRequest request) {
        return projectService.update(id, request);
    }

    @PostMapping("/{id}/token/reissue")
    public TokenResponse reissueToken(@PathVariable Long id, @RequestParam Long userId) {
        return projectService.reissueToken(id, userId);
    }
}
