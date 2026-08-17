package com.semes.reqops.global.ai;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * ai-model 서버와의 HTTP 계약 확인.
 *
 * <p>실제 AI 서버가 떠 있을 때만 실행된다: {@code mvn test -Dai.live=true}
 * (CI/폐쇄망 빌드에서는 자동으로 건너뛴다.)
 */
class AiClientContractTest {

    @Test
    @EnabledIfSystemProperty(named = "ai.live", matches = "true")
    void analyzeFull_모호표현과_상충을_찾고_draft를_돌려준다() {
        AiClient client = new AiClient("http://127.0.0.1:8001", 30000);

        var res = client.analyzeFull(
                "AMR 매칭 시 가용한 AMR 중 가장 가까운 AMR을 선택한다.",
                List.of(new AiAnalyzeDto.Existing("req-ta-01", "태스크는 요청 순으로 할당한다.")));

        assertEquals("full", res.scope());
        assertNotEquals("unavailable", res.engine(), "AI 서버가 떠 있어야 합니다");
        assertTrue(res.findings().size() >= 3, "정량 2건 + 상충 1건 이상");

        // 상충은 문장 치환으로 해결되지 않으므로 conflictReqKey 가 채워진다.
        assertTrue(res.findings().stream()
                .anyMatch(f -> "req-ta-01".equals(f.conflictReqKey())));

        // draft 는 제안이 반영된 문장 — 원문의 모호 표현이 사라져 있어야 한다.
        assertFalse(res.draftContent().contains("가용한 AMR"));
        assertTrue(res.draftContent().contains("IDLE"));
    }

    @Test
    @EnabledIfSystemProperty(named = "ai.live", matches = "true")
    void analyzeDiff_는_변경분만_본다() {
        AiClient client = new AiClient("http://127.0.0.1:8001", 30000);

        var res = client.analyzeDiff(
                "동일 자재 ID에 대해 최대 1건만 허용한다. 우선순위는 SoC 높은 순으로 정한다.",
                "동일 자재 ID에 대해 최대 1건만 허용한다.",
                "req-ta-01과 기준 통일 요청",
                List.of());

        assertEquals("diff", res.scope());
        assertNotNull(res.draftContent());
    }

    @Test
    void AI서버가_없으면_등록을_막지_않고_빈결과를_돌려준다() {
        // 아무것도 없는 포트 — graceful degrade 경로
        AiClient client = new AiClient("http://127.0.0.1:59999", 1000);

        var res = client.analyzeFull("아무 요구사항", List.of());

        assertEquals("unavailable", res.engine());
        assertTrue(res.findings().isEmpty());
        assertEquals("아무 요구사항", res.draftContent(), "draft 는 원문 그대로여야 한다");
    }
}
