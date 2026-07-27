package com.semes.backend.dto;

import java.util.List;

/**
 * 요구사항 한 건의 분석 결과.
 *
 * @param id         요구사항 ID (문서 값 그대로)
 * @param category   분류
 * @param content    내용
 * @param remark     비고
 * @param ambiguous  모호 여부(내용/비고에 모호 지점이 하나라도 있으면 true)
 * @param findings   모호 지점 목록(내용/비고 원문 span)
 * @param suggestion 보완 방향 요약
 */
public record ReqResult(
        String id,
        String category,
        String content,
        String remark,
        boolean ambiguous,
        List<Finding> findings,
        String suggestion) {
}
