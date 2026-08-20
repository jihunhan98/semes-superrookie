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
     * @param consensus      가장 최근 고객 합의 기록. 없으면 null — 이 값이 null 이면 확정할 수 없다.
     * @param canConfirm     지금 확정 가능한지. 합의 기록이 있고 아직 확정 전이면 true.
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
            ConsensusResponse consensus,
            boolean canConfirm,
            String nextVersion,
            List<VersionResponse> versions,
            String createdAt,
            String updatedAt
    ) {}

    /**
     * 고객 합의 기록.
     *
     * <p>{@code agreedContent} 는 합의 시점의 본문이다. 합의 후 본문을 또 고치면 이 값과
     * 달라지므로, 화면이 "재합의가 필요하다"고 알려주는 근거가 된다.
     */
    public record ConsensusResponse(
            Long id,
            String method,
            String customerContact,
            String agreedOn,
            String note,
            String agreedContent,
            String recordedByName,
            String createdAt
    ) {}

    /** 합의 기록 요청 — 이 기록이 있어야만 확정할 수 있다. */
    public record ConsensusRequest(
            @NotNull Long userId,
            @NotBlank @Size(max = 40) String method,
            @NotBlank @Size(max = 100) String customerContact,
            /** yyyy-MM-dd. */
            @NotBlank String agreedOn,
            @Size(max = 2000) String note,
            /** 이 합의로 확정하기로 한 본문 — 화면의 "확정될 본문" 값을 그대로 보낸다. */
            @NotBlank String agreedContent
    ) {}

    /**
     * 확정 요청.
     *
     * @param content 확정할 본문. 합의 기록 이후에도 화면에서 고칠 수 있으므로 다시 받는다.
     * @param title   버전 이력 제목. 최초 확정이면 비워 보내면 되고, 서버가 "최초 확정"으로 넣는다.
     */
    public record ConfirmRequest(
            @NotNull Long userId,
            @NotBlank String content,
            @Size(max = 200) String title
    ) {}

    /** 보류 — 고객 협의가 더 필요해 확정을 미룬다. */
    public record HoldRequest(
            @NotNull Long userId
    ) {}

    /** 버전 이력 한 줄. */
    public record VersionResponse(
            Long id,
            String version,
            String title,
            String content,
            String confirmedByName,
            String createdAt
    ) {}
}
