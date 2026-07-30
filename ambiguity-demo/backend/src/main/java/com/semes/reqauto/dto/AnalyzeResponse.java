package com.semes.reqauto.dto;

import java.util.List;

/** 백엔드 → 프론트 응답: 판정 모드 + 조항별 결과 목록. */
public record AnalyzeResponse(
		String mode,
		List<ClauseResult> clauses) {
}
