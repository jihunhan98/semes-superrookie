package com.semes.reqops.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 프론트 오리진을 고정 값 하나로 두지 않는다.
 *
 * <p>이 앱은 프론트·백엔드가 항상 같은 컴퓨터에서 뜨고, 그 컴퓨터를
 * {@code localhost}로 열 수도, LAN IP(예: 다른 회의실 컴퓨터에서 접속)로 열 수도
 * 있다. 오리진을 {@code http://localhost:3000} 하나로 고정해 두면, LAN IP로
 * 접속했을 때 브라우저가 보내는 {@code Origin} 헤더(예:
 * {@code http://192.168.0.5:3000})와 안 맞아서 CORS 로 막힌다.
 *
 * <p>세션·쿠키를 안 쓰고(요청마다 userId 를 직접 넘김) 폐쇄망 내부용이라,
 * 오리진을 넓게 허용해도 자격 증명이 새는 것과는 무관하다.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000}")
    private String[] allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS");
    }
}
