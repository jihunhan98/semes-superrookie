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

    @Test
    void AI서버가_없어도_이슈나누기_화면은_빈화면이_아니다() {
        // "이슈 나누기" 화면이 아무것도 못 보여주면 안 되므로, 실패 시 본문 전체를
        // 이슈 1개로 돌려줘야 한다(사람이 그 위에서 나누기로 쪼갤 수 있게).
        AiClient client = new AiClient("http://127.0.0.1:59999", 1000);

        var res = client.splitIssues("가용 AMR을 매칭한다.", null);

        assertEquals("unavailable", res.engine());
        assertEquals(1, res.issues().size());
        assertEquals("가용 AMR을 매칭한다.", res.issues().get(0).quote());
    }

    @Test
    @EnabledIfSystemProperty(named = "ai.live", matches = "true")
    void splitIssues_는_문장별로_이슈후보를_나눈다() {
        AiClient client = new AiClient("http://127.0.0.1:8001", 30000);

        var res = client.splitIssues(
                "가용한 AMR 중 우선순위가 높은 AMR을 선택한다. 알람이 발생하면 다른 AMR로 재할당한다.", null);

        assertNotEquals("unavailable", res.engine(), "AI 서버가 떠 있어야 합니다");
        assertTrue(res.issues().size() >= 2);
        // quote 는 반드시 원문 그대로의 구절이어야 한다(환각 방지 검증 대상).
        res.issues().forEach(i -> assertFalse(i.quote().isBlank()));
    }
}
