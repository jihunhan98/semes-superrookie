package com.semes.logviz;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * VCS 로그 시각화 스파이크 — 더미 시뮬레이터 백엔드.
 *
 * VCS APP 8개 모듈이 표준 envelope 포맷(VCS_LOG_VISUALIZATION_DESIGN.md 3.1)으로
 * 로그를 쏘는 상황을 시뮬레이션한다. 실제 모듈 대신 내장 시뮬레이터가
 * 5대의 AMR / newAMOS Job 생성 / JobAssign 할당 / PathSearch(다익스트라) /
 * 이동·충전을 굴리면서 로그를 만들고, 웹 프론트는 이 로그만 보고 화면을 그린다.
 *
 * 실행:  mvn spring-boot:run
 * 접속:  http://localhost:8300
 */
@SpringBootApplication
@EnableScheduling
public class LogVizApplication {

	public static void main(String[] args) {
		SpringApplication.run(LogVizApplication.class, args);
	}
}
