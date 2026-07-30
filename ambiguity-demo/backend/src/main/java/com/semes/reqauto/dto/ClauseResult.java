package com.semes.reqauto.dto;

/** 조항 1건의 모호성 판정 결과. */
public record ClauseResult(
		String id,
		String text,
		boolean ambiguous,
		String type,
		String reason,
		String suggestion) {
}
