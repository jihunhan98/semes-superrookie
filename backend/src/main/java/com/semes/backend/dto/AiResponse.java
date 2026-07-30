package com.semes.backend.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** AI 서버(FastAPI) /analyze 응답 매핑용. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record AiResponse(
        String mode,
        boolean ambiguous,
        List<Finding> findings,
        String suggestion) {
}
