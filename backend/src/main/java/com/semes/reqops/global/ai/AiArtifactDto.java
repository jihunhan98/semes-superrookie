package com.semes.reqops.global.ai;

import java.util.Map;

/** AI 서버(ai-model)의 산출물 생성(/artifacts/generate)과 주고받는 DTO. */
public final class AiArtifactDto {

    private AiArtifactDto() {
    }

    /**
     * @param type               voc | functional | nonfunctional | detail-design (프론트 URL 슬러그와 동일)
     * @param issueTitle         개발 이슈 제목
     * @param issueQuote         이 이슈가 커버하는 요구사항 구절
     * @param requirementContent 근거가 된 확정 요구사항 전문 — 도메인 맥락용
     * @param reason             재생성 시 사람이 적은 참고 내용. 선택.
     */
    public record Request(String type, String issueTitle, String issueQuote,
                          String requirementContent, String reason) {}

    /** @param engine llm-api | rule | unavailable(AI 서버 자체 미응답 — 백엔드가 채움) */
    public record Response(Map<String, Object> content, String engine, Integer elapsedMs) {}
}
