package com.semes.backend.dto;

/**
 * 한 조항에서 검출된 모호 지점 하나.
 * DESIGN 2.5의 findings[] 항목과 동일한 구조.
 *
 * @param span   모호한 부분 문자열(원문 발췌)
 * @param type   모호성 유형(DESIGN 2.1의 7종 중 하나)
 * @param reason 왜 모호한지 근거
 */
public record Finding(String span, String type, String reason) {
}
