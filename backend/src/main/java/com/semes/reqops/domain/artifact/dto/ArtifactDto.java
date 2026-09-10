package com.semes.reqops.domain.artifact.dto;

import jakarta.validation.constraints.NotNull;

import java.util.Map;

/** 산출물 상세 화면(4종 공통) 요청/응답 DTO 모음. */
public final class ArtifactDto {

    private ArtifactDto() {
    }

    /** @param reason 화면의 "재생성 시 참고할 내용" — 선택 입력. */
    public record RegenerateRequest(
            @NotNull Long userId,
            String reason
    ) {}

    /** 사람이 편집한 최종 내용 — 필드 구조는 유형마다 달라 그대로 통과시킨다. */
    public record ConfirmRequest(
            @NotNull Long userId,
            @NotNull Map<String, Object> content
    ) {}

    /** @param engine llm-api | rule | unavailable — 다른 AI 결과 화면과 같은 배지 의미. */
    public record ArtifactResponse(
            String type,
            String state,
            Map<String, Object> content,
            String engine,
            String updatedAt
    ) {}
}
