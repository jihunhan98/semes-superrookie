# log-visualizer-spike

[VCS_LOG_VISUALIZATION_DESIGN.md](../VCS_LOG_VISUALIZATION_DESIGN.md)의 실시간 모니터링 샘플 구현 (스파이크).
진행 기록은 [docs/spike-log-visualizer.md](../docs/spike-log-visualizer.md) 참고.

## 구성

- **백엔드 (Spring Boot, Java 21)**: 실제 VCS APP 8개 모듈 대신 내장 더미 시뮬레이터가
  5대 AMR / newAMOS Job 생성 / JobAssign 할당 / PathSearch(다익스트라) / 이동·충전을
  실제 로직으로 굴리면서, 표준 envelope 포맷 로그를 HTTP API로 제공한다.
- **프론트엔드 (순수 HTML/JS/Canvas)**: 로그 API만 보고 화면 전체를 그린다
  (설계 원칙: 뷰는 로그의 함수).

## 실행

```bash
mvn spring-boot:run
# → http://localhost:8300
```

## API

| 엔드포인트 | 설명 |
|---|---|
| `GET /api/map` | 맵(노드/링크) + 버전. 최초 1회 호출 |
| `GET /api/logs?since={seq}&limit={n}` | 표준 envelope 로그 증분 조회 (프론트가 0.7초 간격 폴링) |

## 화면

- **라인 맵**: Stocker/Prober/ChargeStation 노드 + 링크, AMR 실시간 위치,
  진행 중 Task의 계획 경로(PathSearch 결과)와 목적지 하이라이트
- **AMR 상태**: 5대 각각의 상태(RUNNING/IDLE/CHARGING)/현재 Task/현재 노드→목적지/배터리
- **Job/Task 현황**: newAMOS로부터 받은 Job 목록, 할당 AMR, 진행 단계(n/8), 상태(대기/진행중/EDS 테스트중/완료)
- **로그 피드**: envelope 원본을 모듈별 색상으로 스트리밍
- **상단 KPI**: 맵 버전(MAP_UPDATED 기준), Job 상태별 집계
