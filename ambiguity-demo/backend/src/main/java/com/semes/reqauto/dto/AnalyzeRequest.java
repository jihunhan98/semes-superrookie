package com.semes.reqauto.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/** 프론트 → 백엔드 요청: 요구사항 원문(여러 줄, 한 줄에 조항 하나). */
public record AnalyzeRequest(
		@Schema(description = "요구사항 원문 (한 줄에 조항 하나)",
				example = "장비는 충분한 내구성을 가져야 한다.\nAMR은 IEC 60204-1 규격을 만족해야 한다.")
		String text) {
}
