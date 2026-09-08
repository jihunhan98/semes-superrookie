package com.semes.reqops.global.ai;

import java.util.List;

/** AI 서버(ai-model)의 이슈 분할(/split)과 주고받는 DTO. 필드명이 FastAPI 스키마와 1:1로 맞아야 한다. */
public final class AiSplitDto {

    private AiSplitDto() {
    }

    /**
     * @param content 분할할 확정 요구사항 본문
     * @param reason  사람이 "AI에게 물어보기"에 적은 참고 지시. 선택.
     */
    public record Request(String content, String reason) {}

    /** @param quote content 안에 그대로 등장하는 구절이어야 한다 — 화면이 원문에 형광펜을 칠하기 위함. */
    public record IssueOut(String title, String quote) {}

    /** @param engine llm-api | rule | unavailable(AI 서버 자체 미응답 — 백엔드가 채움) */
    public record Response(List<IssueOut> issues, String engine, Integer elapsedMs) {}
}
