package com.semes.reqops.domain.requirement.controller;

import com.semes.reqops.domain.requirement.dto.RequirementDto.CreateRequest;
import com.semes.reqops.domain.requirement.dto.RequirementDto.DetailResponse;
import com.semes.reqops.domain.requirement.dto.RequirementDto.SummaryResponse;
import com.semes.reqops.domain.requirement.service.RequirementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects/{projectId}/requirements")
@RequiredArgsConstructor
public class RequirementController {

    private final RequirementService requirementService;

    /**
     * 요구사항 최초 등록.
     *
     * <p>AI 초기 검토가 끝난 뒤에 응답한다(동기). 그래서 프론트는 이 호출 동안
     * 로딩을 보여주고, 응답이 오면 AI 참고 의견까지 준비된 상태가 된다.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DetailResponse create(@PathVariable Long projectId,
                                 @Valid @RequestBody CreateRequest request) {
        return requirementService.create(projectId, request);
    }

    @GetMapping
    public List<SummaryResponse> list(@PathVariable Long projectId, @RequestParam Long userId) {
        return requirementService.list(projectId, userId);
    }

    /** 담당자 필터 후보 — 프로젝트 멤버 전원. */
    @GetMapping("/assignees")
    public List<Map<String, Object>> assignees(@PathVariable Long projectId, @RequestParam Long userId) {
        return requirementService.assigneeCandidates(projectId, userId);
    }

    @GetMapping("/{requirementId}")
    public DetailResponse detail(@PathVariable Long projectId,
                                 @PathVariable Long requirementId,
                                 @RequestParam Long userId) {
        return requirementService.detail(projectId, requirementId, userId);
    }

    /** AI 재분석 — 화면의 "↻ 다시 분석". */
    @PostMapping("/{requirementId}/analyze")
    public DetailResponse reanalyze(@PathVariable Long projectId,
                                    @PathVariable Long requirementId,
                                    @RequestParam Long userId) {
        return requirementService.reanalyze(projectId, requirementId, userId);
    }
}
