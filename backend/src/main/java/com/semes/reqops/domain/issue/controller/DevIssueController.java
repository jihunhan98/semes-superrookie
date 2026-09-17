package com.semes.reqops.domain.issue.controller;

import com.semes.reqops.domain.artifact.entity.ArtifactType;
import com.semes.reqops.domain.artifact.service.ArtifactService;
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
    private final ArtifactService artifactService;

    /** AI 분할 초안 — 아무것도 저장하지 않는다. 화면 진입 시·"AI 다시 나눠줘" 클릭 시 호출. */
    @PostMapping("/split-preview")
    public SplitPreviewResponse splitPreview(@PathVariable Long projectId,
                                             @PathVariable Long requirementId,
                                             @Valid @RequestBody SplitPreviewRequest request) {
        return devIssueService.preview(projectId, requirementId, request);
    }

    /**
     * 분할 확정 — 사람이 다듬은 최종 목록으로 기존 이슈를 교체한다.
     *
     * <p>확정 직후 이슈별 산출물 4종을 백그라운드에서 미리 만들어 둔다. 이 호출이
     * 끝난 뒤에 시작하는 이유는, {@code confirmSplit}이 끝나야(=트랜잭션 커밋)
     * 방금 새로 쌓은 이슈들이 다른 스레드(백그라운드 작업)에도 보이기 때문이다 —
     * 커밋 전에 미리 돌리면 아직 없는 이슈를 찾다가 실패한다. {@code warmDraftAsync}
     * 자체는 스레드풀에 작업만 던지고 곧장 리턴되므로, 이 응답은 기다리지 않는다.
     */
    @PostMapping
    public List<IssueResponse> confirmSplit(@PathVariable Long projectId,
                                            @PathVariable Long requirementId,
                                            @Valid @RequestBody ConfirmSplitRequest request) {
        List<IssueResponse> issues = devIssueService.confirmSplit(projectId, requirementId, request);
        for (IssueResponse issue : issues) {
            for (ArtifactType type : ArtifactType.values()) {
                artifactService.warmDraftAsync(projectId, requirementId, issue.issueKey(), type.slug(), request.userId());
            }
        }
        return issues;
    }

    @GetMapping
    public List<IssueResponse> list(@PathVariable Long projectId,
                                    @PathVariable Long requirementId,
                                    @RequestParam Long userId) {
        return devIssueService.list(projectId, requirementId, userId);
    }
}
