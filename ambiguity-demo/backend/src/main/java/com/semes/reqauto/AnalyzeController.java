package com.semes.reqauto;

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

import com.semes.reqauto.dto.AiResponse;
import com.semes.reqauto.dto.AnalyzeRequest;
import com.semes.reqauto.dto.AnalyzeResponse;
import com.semes.reqauto.dto.ClauseResult;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * 요구사항 텍스트를 받아 조항 단위로 나누고, 각 조항의 모호성 판정을
 * AI 서버(FastAPI)에 위임해 취합한다.
 */
@RestController
@RequestMapping("/api")
@Tag(name = "모호성 분석", description = "요구사항 조항별 모호성 검출")
public class AnalyzeController {

	private static final Pattern BULLET = Pattern.compile("^\\s*(\\d+[.)]|[-•·])\\s*");

	private final RestClient ai;

	public AnalyzeController(RestClient aiRestClient) {
		this.ai = aiRestClient;
	}

	@Operation(summary = "요구사항 모호성 분석",
			description = "요구사항 원문을 조항 단위로 분리하고, 각 조항을 AI 서버로 판정해 결과를 반환한다.")
	@PostMapping("/analyze")
	public AnalyzeResponse analyze(@RequestBody AnalyzeRequest req) {
		List<ClauseResult> clauses = new ArrayList<>();
		String mode = "mock";
		int i = 1;
		for (String text : splitClauses(req.text())) {
			String id = "REQ-2026-%03d".formatted(i++);
			AiResponse res = callAi(text);
			if (res != null) {
				if (res.mode() != null) {
					mode = res.mode();
				}
				clauses.add(new ClauseResult(id, text, res.ambiguous(), res.type(), res.reason(), res.suggestion()));
			} else {
				clauses.add(new ClauseResult(id, text, false, null, "AI 서버 호출 실패", null));
			}
		}
		return new AnalyzeResponse(mode, clauses);
	}

	private AiResponse callAi(String sentence) {
		try {
			return ai.post()
					.uri("/analyze")
					.contentType(MediaType.APPLICATION_JSON)
					.body(Map.of("sentence", sentence))
					.retrieve()
					.body(AiResponse.class);
		} catch (Exception e) {
			return null;
		}
	}

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
