package com.semes.reqauto.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * AI 서버(FastAPI) 호출용 RestClient.
 *
 * 주의: 기본 RestClient의 JDK HttpClient는 HTTP/1.1 요청에도 'Upgrade: h2c' 헤더를 붙여,
 * uvicorn(FastAPI)이 이를 웹소켓 업그레이드로 오인해 422를 반환하는 문제가 있다.
 * → SimpleClientHttpRequestFactory(순수 HttpURLConnection, HTTP/1.1)로 교체해 회피한다.
 */
@Configuration
public class RestClientConfig {

	@Bean
	public RestClient aiRestClient(@Value("${ai.server.url}") String baseUrl) {
		return RestClient.builder()
				.baseUrl(baseUrl)
				.requestFactory(new SimpleClientHttpRequestFactory())
				.build();
	}
}
