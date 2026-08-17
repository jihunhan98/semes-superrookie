package com.semes.reqops.domain.requirement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** 요구사항 관련 요청/응답 DTO 모음. */
public final class RequirementDto {

    private RequirementDto() {
    }

    /** 최초 등록. 등록 즉시 AI 초기 검토까지 끝난 뒤 응답이 온다(그래서 화면에 로딩이 뜬다). */
    public record CreateRequest(
            @NotNull Long userId,
            @NotBlank @Size(max = 50) String reqKey,
            @NotBlank String content,
            @Size(max = 100) String requesterDept,
            @Size(max = 50) String requesterName
    ) {}

    /** AI 검토 결과 한 건 — 화면에서 읽기 전용으로만 표시된다. */
    public record FindingResponse(
            String findingType,
            String targetSpan,
            String reason,
            String suggestion,
            String conflictReqKey
    ) {}

    /** 목록 행. */
    public record SummaryResponse(
            Long id,
            String reqKey,
            String content,
            String state,
            String stateLabel,
            String version,
            Long assigneeId,
            String assigneeName,
            int findingCount,
            String updatedAt
    ) {}

    /**
     * 상세.
     *
     * @param aiDraftContent AI 제안이 반영된 문장 — 확정 화면 본문에 미리 채워지는 값.
     *                       검출이 없으면 원문과 같다.
     */
    public record DetailResponse(
            Long id,
            Long projectId,
            String reqKey,
            String content,
            String requesterDept,
            String requesterName,
            String state,
            String stateLabel,
            String version,
            Long assigneeId,
            String assigneeName,
            String aiDraftContent,
            String aiEngine,
            List<FindingResponse> findings,
            String createdAt,
            String updatedAt
    ) {}
}
