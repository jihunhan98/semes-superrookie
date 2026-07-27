package com.semes.backend;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;

import com.semes.backend.dto.AiResponse;
import com.semes.backend.dto.AnalyzeRequest;
import com.semes.backend.dto.AnalyzeResponse;
import com.semes.backend.dto.Finding;
import com.semes.backend.dto.ReqInput;
import com.semes.backend.dto.ReqResult;

/**
 * 핵심 기능 1 — 모호성 검출의 백엔드.
 *
 * <p>요구사항은 docx 표의 한 행(ID·분류·내용·비고) = 한 건이다. 각 요구사항의 내용+비고를
 * 통째로 AI 서버(FastAPI)에 위임해 모호 지점을 받고, 결과를 취합해 반환한다.
 * (해결·전후비교는 프론트에서 수행)
 */
@RestController
@RequestMapping("/api")
public class AnalyzeController {

    private final RestClient ai;

    public AnalyzeController(RestClient aiRestClient) {
        this.ai = aiRestClient;
    }

    @PostMapping("/analyze")
    public AnalyzeResponse analyze(@RequestBody AnalyzeRequest req) {
        List<ReqResult> results = new ArrayList<>();
        String mode = "mock";
        String engine = req.engine() != null ? req.engine() : "local";
        List<ReqInput> reqs = req.reqs() != null ? req.reqs() : List.of();

        int seq = 1;
        for (ReqInput r : reqs) {
            String content = r.content() != null ? r.content() : "";
            String remark = r.remark() != null ? r.remark() : "";
            if (content.isBlank() && remark.isBlank()) {
                continue; // 내용·비고가 모두 비면 분석 대상 아님
            }
            String category = r.category() != null ? r.category() : "";
            // 문서가 준 ID를 그대로 쓴다. 비어 있으면 임시로 순번 부여.
            String id = (r.id() != null && !r.id().isBlank()) ? r.id().strip()
                    : "REQ-%03d".formatted(seq);
            seq++;

            AiResponse res = callAi(category, content, remark, engine);
            if (res != null) {
                if (res.mode() != null) {
                    mode = res.mode();
                }
                List<Finding> findings = res.findings() != null ? res.findings() : List.of();
                results.add(new ReqResult(id, category, content, remark,
                        res.ambiguous(), findings, res.suggestion()));
            } else {
                // AI 서버 호출 실패 시: 지어내지 않고 '판정 불가'로 남긴다.
                results.add(new ReqResult(id, category, content, remark, false, List.of(), ""));
            }
        }
        return new AnalyzeResponse(mode, results);
    }

    /** 요구사항 한 건(분류/내용/비고)의 모호성 판정을 AI 서버에 요청한다. */
    private AiResponse callAi(String category, String content, String remark, String engine) {
        try {
            return ai.post()
                    .uri("/analyze")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "category", category,
                            "content", content,
                            "remark", remark,
                            "engine", engine))
                    .retrieve()
                    .body(AiResponse.class);
        } catch (Exception e) {
            return null;
        }
    }
}
