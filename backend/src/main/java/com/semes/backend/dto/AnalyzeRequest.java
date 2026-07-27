package com.semes.backend.dto;

/**
 * 프론트가 보내는 분석 요청.
 *
 * @param text   요구사항 원문(여러 조항이 줄바꿈으로 구분됨)
 * @param engine 판정 엔진: "local"(Ollama) | "playground"(사내 LLM API). null이면 local.
 */
public record AnalyzeRequest(String text, String engine) {
}
