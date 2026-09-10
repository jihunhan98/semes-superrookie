package com.semes.reqops.domain.artifact.controller;

import com.semes.reqops.domain.artifact.dto.ArtifactDto.ArtifactResponse;
import com.semes.reqops.domain.artifact.dto.ArtifactDto.ConfirmRequest;
import com.semes.reqops.domain.artifact.dto.ArtifactDto.RegenerateRequest;
import com.semes.reqops.domain.artifact.service.ArtifactService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/** 산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design) 상세 — 개발 이슈 1건당 1개씩(산출물 도출 2단계). */
@RestController
@RequestMapping("/api/projects/{projectId}/requirements/{requirementId}/issues/{issueKey}/artifacts/{type}")
@RequiredArgsConstructor
public class ArtifactController {

    private final ArtifactService artifactService;

    /** 조회 — 저장된 게 없으면 이 자리에서 AI 초안을 만들어 저장한 뒤 돌려준다. */
    @GetMapping
    public ArtifactResponse get(@PathVariable Long projectId, @PathVariable Long requirementId,
                                @PathVariable String issueKey, @PathVariable String type,
                                @RequestParam Long userId) {
        return artifactService.get(projectId, requirementId, issueKey, type, userId);
    }

    /** AI로 다시 생성 — "재생성 시 참고할 내용"을 반영해 새 초안으로 덮어쓴다(DRAFT로 되돌아감). */
    @PostMapping("/regenerate")
    public ArtifactResponse regenerate(@PathVariable Long projectId, @PathVariable Long requirementId,
                                       @PathVariable String issueKey, @PathVariable String type,
                                       @Valid @RequestBody RegenerateRequest request) {
        return artifactService.regenerate(projectId, requirementId, issueKey, type, request);
    }

    /** 확정 — 사람이 다듬은 최종 내용을 저장한다. */
    @PostMapping("/confirm")
    public ArtifactResponse confirm(@PathVariable Long projectId, @PathVariable Long requirementId,
                                    @PathVariable String issueKey, @PathVariable String type,
                                    @Valid @RequestBody ConfirmRequest request) {
        return artifactService.confirm(projectId, requirementId, issueKey, type, request);
    }
}
