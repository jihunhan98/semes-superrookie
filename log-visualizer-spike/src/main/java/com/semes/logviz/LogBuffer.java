package com.semes.logviz;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.stereotype.Component;

/**
 * 로그 버퍼 — 표준 envelope 포맷(VCS_LOG_VISUALIZATION_DESIGN.md 3.1) 그대로 적재,
 * /api/logs 로 증분 제공. 실제 시스템에서는 Oracle DB 저장으로 대체될 부분.
 */
@Component
public class LogBuffer {

	private static final int MAX = 8000;

	private final Deque<Map<String, Object>> buffer = new ArrayDeque<>();
	private final AtomicLong seq = new AtomicLong(0);

	public synchronized void emit(String module, String type,
			Map<String, Object> correlationIds, Map<String, Object> payload) {
		Map<String, Object> log = new LinkedHashMap<>();
		log.put("seq", seq.incrementAndGet());
		log.put("timestamp", Instant.now().truncatedTo(ChronoUnit.MILLIS).toString());
		log.put("module", module);
		log.put("type", type);
		log.put("correlationIds", correlationIds);
		log.put("payload", payload);
		buffer.addLast(log);
		if (buffer.size() > MAX) {
			buffer.removeFirst();
		}
	}

	public synchronized List<Map<String, Object>> since(long sinceSeq, int limit) {
		List<Map<String, Object>> out = new ArrayList<>();
		for (Map<String, Object> log : buffer) {
			if ((long) log.get("seq") > sinceSeq) {
				out.add(log);
				if (out.size() >= limit) {
					break;
				}
			}
		}
		return out;
	}
}
