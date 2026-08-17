package com.semes.reqops.global.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;

/**
 * AI 서버(ai-model, FastAPI) 호출 클라이언트.
 *
 * <p>AI가 죽어 있어도 요구사항 등록 자체는 되어야 하므로, 실패 시 예외를 던지지 않고
 * <b>빈 결과 + 원문</b>을 돌려준다(graceful degrade). 그 경우 화면에는 검출 0건으로
 * 보이고, 나중에 "다시 분석"으로 재요청할 수 있다.
 *
 * <p>RestClient 의 기본 요청 팩토리(JDK HttpClient)는 HTTP/1.1 요청에도
 * {@code Upgrade: h2c} 헤더를 붙이는데, uvicorn 이 이걸 웹소켓 업그레이드로 오인해
 * 422 를 반환한다. 그래서 {@link SimpleClientHttpRequestFactory} 로 교체했다.
 * (docs/spike-ambiguity-detector.md 3단계에서 겪은 문제)
 */
@Slf4j
@Component
public class AiClient {

    private final RestClient restClient;

    public AiClient(@Value("${app.ai.base-url}") String baseUrl,
                    @Value("${app.ai.timeout-ms:30000}") int timeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofMillis(3000));
        factory.setReadTimeout(Duration.ofMillis(timeoutMs));

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(factory)
                .build();
    }

    /** 최초 확정용 — 본문 전체를 검토한다. */
    public AiAnalyzeDto.Response analyzeFull(String content, List<AiAnalyzeDto.Existing> existing) {
        return call(new AiAnalyzeDto.Request(content, null, null, existing), content);
    }

    /** 확정본 수정용 — 바뀐 부분과 사유만 검토한다. */
    public AiAnalyzeDto.Response analyzeDiff(String content, String baseContent, String reason,
                                             List<AiAnalyzeDto.Existing> existing) {
        return call(new AiAnalyzeDto.Request(content, baseContent, reason, existing), content);
    }

    private AiAnalyzeDto.Response call(AiAnalyzeDto.Request request, String fallbackContent) {
        try {
            AiAnalyzeDto.Response res = restClient.post()
                    .uri("/analyze")
                    .body(request)
                    .retrieve()
                    .body(AiAnalyzeDto.Response.class);

            if (res == null) {
                return unavailable(fallbackContent);
            }
            log.info("AI 검토 완료 — engine={} scope={} findings={}",
                    res.engine(), res.scope(),
                    res.findings() == null ? 0 : res.findings().size());
            return res;
        } catch (Exception e) {
            log.warn("AI 서버 호출 실패 — 검출 0건으로 진행합니다: {}", e.getMessage());
            return unavailable(fallbackContent);
        }
    }

    /** AI를 못 쓴 경우: 검출 없음 + draft 는 원문 그대로. */
    private AiAnalyzeDto.Response unavailable(String content) {
        return new AiAnalyzeDto.Response(List.of(), content, "unavailable", "none", 0);
    }
}
