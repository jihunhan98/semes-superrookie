package com.semes.backend.dto;

import java.util.List;

/**
 * 분석 요청 — 요구사항 여러 건(표의 여러 행)을 한 번에 보낸다.
 *
 * @param reqs   요구사항 목록
 * @param engine 판정 엔진: "local"(Ollama) | "playground"(사내 LLM API). null이면 local.
 */
public record AnalyzeRequest(List<ReqInput> reqs, String engine) {
}
