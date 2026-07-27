package com.semes.backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** AI 서버(FastAPI) 호출용 RestClient. */
@Configuration
public class RestClientConfig {

    @Value("${ai.server.url}")
    private String aiServerUrl;

    @Bean
    public RestClient aiRestClient() {
        // SimpleClientHttpRequestFactory 사용:
        // 기본 팩토리가 h2c 업그레이드 헤더를 붙이면 uvicorn이 422로 거절하는 이슈가 있어
        // 단순 HTTP/1.1 커넥션으로 고정한다.
        return RestClient.builder()
                .baseUrl(aiServerUrl)
                .requestFactory(new SimpleClientHttpRequestFactory())
                .build();
    }
}
