package com.semes.reqauto;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 요구사항 모호성 분석 백엔드.
 *
 * 흐름: React(프론트) → 이 Spring Boot(REST) → AI가 필요한 요청은 FastAPI(AI 서버)로 위임 → JSON 수신.
 * Swagger UI: http://localhost:8080/swagger-ui.html
 */
@SpringBootApplication
public class ReqAutoApplication {
	public static void main(String[] args) {
		SpringApplication.run(ReqAutoApplication.class, args);
	}
}
