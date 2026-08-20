package com.semes.reqops.domain.requirement.controller;

import com.semes.reqops.domain.requirement.dto.RequirementDto.CompareResponse;
import com.semes.reqops.domain.requirement.dto.RequirementDto.ConfirmRequest;
import com.semes.reqops.domain.requirement.dto.RequirementDto.ConsensusRequest;
import com.semes.reqops.domain.requirement.dto.RequirementDto.CreateRequest;
import com.semes.reqops.domain.requirement.dto.RequirementDto.DiffAnalyzeRequest;
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

    /**
     * 확정본 수정 시 AI 검토 — 확정본 대비 <b>바뀐 부분과 사유만</b> 본다.
     *
     * <p>본문 전체를 보는 {@code /analyze} 와 나눠 둔 이유: 이미 고객과 합의된 나머지
     * 문장을 다시 검토해서 흔들지 않으려는 것.
     */
    @PostMapping("/{requirementId}/diff-analyze")
    public DetailResponse diffAnalyze(@PathVariable Long projectId,
                                      @PathVariable Long requirementId,
                                      @Valid @RequestBody DiffAnalyzeRequest request) {
        return requirementService.diffAnalyze(projectId, requirementId, request);
    }

    /**
     * 고객 합의 기록 — 확정 화면 2단계.
     *
     * <p>이 기록이 있어야만 확정할 수 있다. 합의할 때마다 새로 쌓이고,
     * 확정은 가장 마지막 기록을 근거로 삼는다.
     */
    @PostMapping("/{requirementId}/consensus")
    public DetailResponse recordConsensus(@PathVariable Long projectId,
                                          @PathVariable Long requirementId,
                                          @Valid @RequestBody ConsensusRequest request) {
        return requirementService.recordConsensus(projectId, requirementId, request);
    }

    /** 확정 — 확정 화면 3단계. 합의 기록이 없으면 409. */
    @PostMapping("/{requirementId}/confirm")
    public DetailResponse confirm(@PathVariable Long projectId,
                                  @PathVariable Long requirementId,
                                  @Valid @RequestBody ConfirmRequest request) {
        return requirementService.confirm(projectId, requirementId, request);
    }

    /**
     * 버전 비교 — 화면 6의 split diff.
     *
     * <p>base/head 를 생략하면 "직전 버전 ↔ 최신 버전"을 본다.
     */
    @GetMapping("/{requirementId}/compare")
    public CompareResponse compare(@PathVariable Long projectId,
                                   @PathVariable Long requirementId,
                                   @RequestParam Long userId,
                                   @RequestParam(required = false) String base,
                                   @RequestParam(required = false) String head) {
        return requirementService.compare(projectId, requirementId, userId, base, head);
    }

    /** 보류 — 고객 협의가 더 필요할 때. 나중에 이어서 확정할 수 있다. */
    @PostMapping("/{requirementId}/hold")
    public DetailResponse hold(@PathVariable Long projectId,
                               @PathVariable Long requirementId,
                               @RequestParam Long userId) {
        return requirementService.hold(projectId, requirementId, userId);
    }
}
