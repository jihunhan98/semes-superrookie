package com.semes.reqops.domain.issue.controller;

import com.semes.reqops.domain.issue.dto.IssueDto.ConfirmSplitRequest;
import com.semes.reqops.domain.issue.dto.IssueDto.IssueResponse;
import com.semes.reqops.domain.issue.dto.IssueDto.SplitPreviewRequest;
import com.semes.reqops.domain.issue.dto.IssueDto.SplitPreviewResponse;
import com.semes.reqops.domain.issue.service.DevIssueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** "이슈 나누기" 화면(산출물 도출 1단계) — 요구사항 1건을 개발 이슈 N건으로 나눈다. */
@RestController
@RequestMapping("/api/projects/{projectId}/requirements/{requirementId}/issues")
@RequiredArgsConstructor
public class DevIssueController {

    private final DevIssueService devIssueService;

    /** AI 분할 초안 — 아무것도 저장하지 않는다. 화면 진입 시·"AI 다시 나눠줘" 클릭 시 호출. */
    @PostMapping("/split-preview")
    public SplitPreviewResponse splitPreview(@PathVariable Long projectId,
                                             @PathVariable Long requirementId,
                                             @Valid @RequestBody SplitPreviewRequest request) {
        return devIssueService.preview(projectId, requirementId, request);
    }

    /** 분할 확정 — 사람이 다듬은 최종 목록으로 기존 이슈를 교체한다. */
    @PostMapping
    public List<IssueResponse> confirmSplit(@PathVariable Long projectId,
                                            @PathVariable Long requirementId,
                                            @Valid @RequestBody ConfirmSplitRequest request) {
        return devIssueService.confirmSplit(projectId, requirementId, request);
    }

    @GetMapping
    public List<IssueResponse> list(@PathVariable Long projectId,
                                    @PathVariable Long requirementId,
                                    @RequestParam Long userId) {
        return devIssueService.list(projectId, requirementId, userId);
    }
}
