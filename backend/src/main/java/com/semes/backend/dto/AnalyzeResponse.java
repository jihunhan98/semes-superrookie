package com.semes.backend.dto;

import java.util.List;

/**
 * /api/analyze 응답.
 *
 * @param mode    판정기(ollama | mock) — 조항 판정 중 관측된 모드
 * @param clauses 조항별 결과
 */
public record AnalyzeResponse(String mode, List<ClauseResult> clauses) {
}
