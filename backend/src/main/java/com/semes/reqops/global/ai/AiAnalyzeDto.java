package com.semes.reqops.global.ai;

import java.util.List;

/** AI 서버(ai-model)와 주고받는 DTO. 필드명이 FastAPI 스키마와 1:1로 맞아야 한다. */
public final class AiAnalyzeDto {

    private AiAnalyzeDto() {
    }

    /** 상충 검출용 — 같은 프로젝트의 기존 요구사항. */
    public record Existing(String reqKey, String content) {}

    /**
     * @param content     검토할 본문
     * @param baseContent 수정 전 확정본. null 이면 본문 전체를, 있으면 변경분만 검토한다.
     * @param reason      수정 사유 (확정본 수정일 때만)
     */
    public record Request(
            String content,
            String baseContent,
            String reason,
            List<Existing> existing
    ) {}

    public record Finding(
            String findingType,
            String targetSpan,
            String reason,
            String suggestion,
            String conflictReqKey
    ) {}

    /**
     * @param draftContent 제안이 모두 반영된 문장 — 확정 화면 본문에 미리 채워지는 값
     * @param engine       llm-api(사내 LLM이 응답함) | unavailable(사내 LLM 미응답, 규칙 결과만).
     *                     AI 서버 자체가 응답하지 않으면(호출 실패) 백엔드가 unavailable 로 채운다.
     * @param scope        full | diff — 본문 전체를 봤는지, 변경분만 봤는지
     */
    public record Response(
            List<Finding> findings,
            String draftContent,
            String engine,
            String scope,
            Integer elapsedMs
    ) {}
}
