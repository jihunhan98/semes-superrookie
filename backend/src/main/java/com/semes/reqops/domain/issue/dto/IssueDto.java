package com.semes.reqops.domain.issue.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** "이슈 나누기" 화면 요청/응답 DTO 모음. */
public final class IssueDto {

    private IssueDto() {
    }

    /**
     * AI 분할 초안 요청 — 아직 아무것도 저장하지 않는다. 화면이 처음 열릴 때와
     * "AI 다시 나눠줘"를 눌렀을 때 모두 이 API를 쓴다.
     *
     * @param reason 화면의 "AI에게 물어보기" — 선택 입력.
     */
    public record SplitPreviewRequest(
            @NotNull Long userId,
            String reason
    ) {}

    /** AI가 제안한 이슈 후보 한 건 — 사람이 합치기·나누기·제목 수정으로 다듬는 시작점. */
    public record IssueCandidate(
            String title,
            String quote
    ) {}

    /** @param engine llm-api | rule | unavailable — 상세 화면과 같은 배지 의미. */
    public record SplitPreviewResponse(
            List<IssueCandidate> issues,
            String engine
    ) {}

    /** 사람이 최종 확정한 이슈 한 건. quote는 원문에 없어도 된다 — 직접 추가한 이슈일 수 있으므로. */
    public record IssueInput(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 4000) String quote
    ) {}

    /**
     * 이슈 분할 확정 — 이 요구사항의 기존 이슈를 전부 지우고 새로 쌓는다.
     *
     * <p>재분할을 별도 이력으로 남기지 않는 이유는 {@link com.semes.reqops.domain.issue.entity.DevIssue}
     * 클래스 설명 참고.
     */
    public record ConfirmSplitRequest(
            @NotNull Long userId,
            @NotEmpty List<@Valid IssueInput> issues
    ) {}

    /** 이슈 한 건 — 산출물 트리 화면(기존 화면 얼개)이 그대로 쓸 수 있는 모양. */
    public record IssueResponse(
            Long id,
            String issueKey,
            String title,
            String quote,
            int displayOrder,
            String createdByName,
            String createdAt
    ) {}
}
