package com.semes.logviz;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 조회 API — 웹 프론트는 이 두 엔드포인트만 사용한다.
 * /api/map  : 맵(노드/링크) + 버전 (최초 1회)
 * /api/logs : 표준 envelope 로그 증분 조회 (폴링)
 */
@RestController
public class ApiController {

	private final LogBuffer logs;

	public ApiController(LogBuffer logs) {
		this.logs = logs;
	}

	@GetMapping("/api/map")
	public Map<String, Object> map() {
		return Map.of(
				"version", MapData.MAP_VERSION,
				"nodes", MapData.NODES.values(),
				"links", MapData.LINKS);
	}

	@GetMapping("/api/logs")
	public Map<String, Object> logs(
			@RequestParam(defaultValue = "0") long since,
			@RequestParam(defaultValue = "500") int limit) {
		List<Map<String, Object>> out = logs.since(since, limit);
		long nextSeq = out.isEmpty() ? since : (long) out.get(out.size() - 1).get("seq");
		return Map.of("nextSeq", nextSeq, "logs", out);
	}
}
