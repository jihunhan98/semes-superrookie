package com.semes.reqauto.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** FastAPI(AI 서버) POST /analyze 응답 매핑. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AiResponse(
		String mode,
		boolean ambiguous,
		String type,
		String reason,
		String suggestion) {
}
