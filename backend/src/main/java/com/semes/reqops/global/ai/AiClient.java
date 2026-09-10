package com.semes.reqops.global.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

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

    /**
     * "이슈 나누기" 화면의 AI 초안 — 확정 요구사항을 개발 이슈 후보 N개로 나눈다.
     *
     * <p>AI 서버 자체가 응답하지 않아도 화면이 비어 있으면 안 되므로, 실패 시 본문
     * 전체를 이슈 1개로 보는 결과를 돌려준다(사람이 그 위에서 나누기로 쪼갤 수 있다).
     */
    public AiSplitDto.Response splitIssues(String content, String reason) {
        try {
            AiSplitDto.Response res = restClient.post()
                    .uri("/split")
                    .body(new AiSplitDto.Request(content, reason))
                    .retrieve()
                    .body(AiSplitDto.Response.class);

            if (res == null) {
                return splitUnavailable(content);
            }
            log.info("AI 이슈 분할 완료 — engine={} issues={}",
                    res.engine(), res.issues() == null ? 0 : res.issues().size());
            return res;
        } catch (Exception e) {
            log.warn("AI 서버 호출 실패 — 이슈 1개(전체 본문)로 진행합니다: {}", e.getMessage());
            return splitUnavailable(content);
        }
    }

    private AiSplitDto.Response splitUnavailable(String content) {
        return new AiSplitDto.Response(List.of(new AiSplitDto.IssueOut("전체 요구사항", content)), "unavailable", 0);
    }

    /**
     * 산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design) 초안 — 개발 이슈 1건당 1개.
     *
     * <p>AI 서버 자체가 응답하지 않아도 산출물 화면이 빈 채로 뜨면 안 되므로, 실패 시
     * "직접 작성해달라"는 안내만 담긴 최소한의 틀을 유형별로 돌려준다.
     */
    public AiArtifactDto.Response generateArtifact(String type, String issueTitle, String issueQuote,
                                                    String requirementContent, String reason,
                                                    List<AiAnalyzeDto.Existing> existing) {
        try {
            AiArtifactDto.Response res = restClient.post()
                    .uri("/artifacts/generate")
                    .body(new AiArtifactDto.Request(type, issueTitle, issueQuote, requirementContent, reason, existing))
                    .retrieve()
                    .body(AiArtifactDto.Response.class);

            if (res == null || res.content() == null || res.content().isEmpty()) {
                return artifactUnavailable(type);
            }
            log.info("AI 산출물 초안 완료 — type={} engine={}", type, res.engine());
            return res;
        } catch (Exception e) {
            log.warn("AI 서버 호출 실패 — 산출물 기본 틀로 진행합니다: {}", e.getMessage());
            return artifactUnavailable(type);
        }
    }

    private AiArtifactDto.Response artifactUnavailable(String type) {
        String notice = "AI 서버에 연결하지 못해 초안을 만들지 못했습니다. 직접 작성해주세요.";
        Map<String, Object> content = switch (type) {
            case "voc" -> Map.of("description", notice, "request", "", "notes", "");
            case "functional" -> Map.of("description", notice, "role", "", "purpose", "", "behaviors", List.of());
            case "nonfunctional" -> Map.of(
                    "description", notice, "role", "", "purpose", "", "behaviors", List.of(), "constraints", "");
            case "detail-design" -> Map.of(
                    "description", notice,
                    "classDiagram", List.of(),
                    "sequenceBeforeCode", "sequenceDiagram\n    Note over Host: " + notice,
                    "sequenceAfterCode", "sequenceDiagram\n    Note over Host: " + notice);
            default -> Map.of("description", notice);
        };
        return new AiArtifactDto.Response(content, "unavailable", 0);
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
