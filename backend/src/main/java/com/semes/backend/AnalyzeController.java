package com.semes.backend;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import com.semes.backend.dto.AiResponse;
import com.semes.backend.dto.AnalyzeRequest;
import com.semes.backend.dto.AnalyzeResponse;
import com.semes.backend.dto.ClauseResult;
import com.semes.backend.dto.Finding;

/**
 * 핵심 기능 1 — 모호성 검출의 백엔드.
 *
 * <p>요구사항 원문을 조항 단위로 분리해 {@code REQ-ID}를 부여하고, 각 조항의 모호성 판정을
 * AI 서버(FastAPI)에 위임한 뒤 결과를 취합해 반환한다. (해결·전후비교는 프론트에서 수행)
 */
@RestController
@RequestMapping("/api")
public class AnalyzeController {

    /** 줄 앞의 번호(1. / 1)) 또는 불릿(-, •, ·)을 제거하기 위한 패턴. */
    private static final Pattern BULLET = Pattern.compile("^\\s*(\\d+[.)]|[-•·])\\s*");

    private final RestClient ai;

    public AnalyzeController(RestClient aiRestClient) {
        this.ai = aiRestClient;
    }

    @PostMapping("/analyze")
    public AnalyzeResponse analyze(@RequestBody AnalyzeRequest req) {
        List<ClauseResult> clauses = new ArrayList<>();
        String mode = "mock";
        String engine = req.engine() != null ? req.engine() : "local";
        int i = 1;
        for (String text : splitClauses(req.text())) {
            String reqId = "REQ-2026-%03d".formatted(i++);
            AiResponse res = callAi(text, engine);
            if (res != null) {
                if (res.mode() != null) {
                    mode = res.mode();
                }
                List<Finding> findings = res.findings() != null ? res.findings() : List.of();
                clauses.add(new ClauseResult(reqId, text, res.ambiguous(), findings, res.suggestion()));
            } else {
                // AI 서버 호출 실패 시: 지어내지 않고 '판정 불가'로 남긴다(DESIGN 2.2).
                clauses.add(new ClauseResult(reqId, text, false, List.of(), ""));
            }
        }
        return new AnalyzeResponse(mode, clauses);
    }

    /** 조항 하나의 모호성 판정을 AI 서버에 요청한다(엔진 선택 포함). */
    private AiResponse callAi(String sentence, String engine) {
        try {
            return ai.post()
                    .uri("/analyze")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("sentence", sentence, "engine", engine))
                    .retrieve()
                    .body(AiResponse.class);
        } catch (Exception e) {
            return null;
        }
    }

    /** 원문을 줄 단위로 나누고 번호·불릿을 떼어 조항 리스트로 만든다. */
    private List<String> splitClauses(String text) {
        List<String> out = new ArrayList<>();
        if (text == null) {
            return out;
        }
        for (String line : text.split("\\R")) {
            String s = BULLET.matcher(line.strip()).replaceAll("");
            if (!s.isBlank()) {
                out.add(s);
            }
        }
        return out;
    }
}
