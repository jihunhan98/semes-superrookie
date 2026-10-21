package com.semes.reqops.domain.jira.controller;
import com.semes.reqops.domain.jira.dto.JiraDto.*;
import com.semes.reqops.domain.jira.service.JiraService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequestMapping("/api/projects/{projectId}/jira") @RequiredArgsConstructor
public class JiraController {
    private final JiraService service;
    @GetMapping("/targets") public List<TargetResponse> list(@PathVariable Long projectId,@RequestParam Long userId){return service.list(projectId,userId);}
    @PostMapping("/targets") @ResponseStatus(HttpStatus.CREATED) public TargetResponse create(@PathVariable Long projectId,@Valid @RequestBody TargetInput input){return service.save(projectId,null,input);}
    @PatchMapping("/targets/{id}") public TargetResponse update(@PathVariable Long projectId,@PathVariable Long id,@Valid @RequestBody TargetInput input){return service.save(projectId,id,input);}
    @DeleteMapping("/targets/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable Long projectId,@PathVariable Long id,@RequestParam Long userId){service.delete(projectId,id,userId);}
    @GetMapping("/requirements/{requirementId}/links") public List<IssueLinkResponse> links(@PathVariable Long projectId,@PathVariable Long requirementId,@RequestParam Long userId){return service.issueLinks(projectId,requirementId,userId);}
    @PostMapping("/requirements/{requirementId}/issues/{issueId}/open") public IssueLinkResponse open(@PathVariable Long projectId,@PathVariable Long requirementId,@PathVariable Long issueId,@Valid @RequestBody OpenRequest input){return service.open(projectId,requirementId,issueId,input);}
}
