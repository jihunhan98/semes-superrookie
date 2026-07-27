package com.semes.backend.dto;

import java.util.List;

/**
 * 조항 하나의 분석 결과. 백엔드가 REQ-ID를 부여하고 AI 판정을 담아 프론트로 보낸다.
 *
 * @param reqId      REQ-2026-NNN
 * @param text       조항 원문
 * @param ambiguous  모호 여부
 * @param findings   모호 지점 목록(모호하지 않으면 빈 목록)
 * @param suggestion 명확하게 고쳐 쓴 예시(해결 입력의 초안으로 쓰임)
 */
public record ClauseResult(
        String reqId,
        String text,
        boolean ambiguous,
        List<Finding> findings,
        String suggestion) {
}
