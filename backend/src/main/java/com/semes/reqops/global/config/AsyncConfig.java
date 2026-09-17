package com.semes.reqops.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * 산출물 초안을 미리 만들어 두는 백그라운드 작업용 스레드풀.
 *
 * <p>이슈 나누기를 확정하면 이슈당 산출물 4종을 한꺼번에 준비해 두는데, 이슈가
 * 여러 개면 요청이 순식간에 수십 건씩 쌓인다(예: 이슈 9개 × 4종 = 36건). 이걸
 * 그대로 다 동시에 쏘면 AI 서버·DB 커넥션 풀이 한꺼번에 막혀 프로젝트 전체가
 * 먹통이 된다 — 그래서 이 전용 풀로만 처리해 동시에 {@link #CONCURRENCY}개까지만
 * 나가게 막는다. 나머지는 큐에서 순서대로 처리되고, 호출한 쪽(컨트롤러)은 기다리지
 * 않고 곧장 응답한다({@code @Async} 메서드는 호출만 하고 리턴됨).
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    private static final int CONCURRENCY = 3;

    @Bean("aiTaskExecutor")
    public Executor aiTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(CONCURRENCY);
        executor.setMaxPoolSize(CONCURRENCY);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("ai-warm-");
        executor.initialize();
        return executor;
    }
}
