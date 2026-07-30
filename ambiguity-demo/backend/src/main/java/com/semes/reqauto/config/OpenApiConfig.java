package com.semes.reqauto.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;

/** Swagger/OpenAPI 문서 메타 정보. */
@Configuration
public class OpenApiConfig {

	@Bean
	public OpenAPI reqAutoOpenAPI() {
		return new OpenAPI().info(new Info()
				.title("요구사항 모호성 분석 API")
				.version("v1")
				.description("React → Spring Boot(이 API) → FastAPI(AI 서버) → 조항별 모호성 판정 JSON"));
	}
}
