# VCS 로그 시각화 도구 — 아이디어 정리 (초안)

> 이 문서는 [VCS_PROJECT_OVERVIEW.md](VCS_PROJECT_OVERVIEW.md)(VCS 프로젝트 전체 맥락)를 전제로 한다. [DESIGN.md](DESIGN.md), [VCS_TROUBLESHOOTING_DESIGN.md](VCS_TROUBLESHOOTING_DESIGN.md)와는 별개의 대안 아이디어.

## 1. 배경 및 목적

VCS APP은 8개 MSA 모듈(Operation, HostInterface, PathSearch, UnitDevice, MapUpdater, ParameterManagement, NATS, JobAssign — 상세는 [VCS_PROJECT_OVERVIEW.md](VCS_PROJECT_OVERVIEW.md) 5번)로 구성되고, 각 모듈이 로그를 남긴다. 지금은 로그가 파일로만 쌓여서, 여러 모듈·여러 AMR이 동시에 남긴 로그를 사람이 텍스트로 대조하며 "그 순간 무슨 일이 있었는지"를 재구성하기 어렵다.

이 프로젝트는 두 가지를 만드는 것을 목표로 한다.

1. **모듈별 로그를 표준 포맷으로 통일하고 REST API로 수집**하는 파이프라인.
2. 수집된 로그를 **맵 위에서 AMR이 실제로 움직이는 모습으로 시각화**하는 뷰어 (+ 모듈별 타임라인/그래프 뷰).

## 2. 예시 로그 (현재 형태 기준)

### 2.1 Operation — AMR Status (주기적으로 계속 수신)

```json
{
  "timestamp": "2026-07-10T09:12:03.482Z",
  "module": "Operation",
  "type": "AMR_STATUS",
  "amrId": "AMR-03",
  "position": { "x": 128.4, "y": 56.2, "nodeId": "NODE-A17" },
  "state": "RUNNING",
  "battery": 76.5,
  "assignedTaskId": "TASK-2026-000481"
}
```
`state`: `RUNNING` / `IDLE` / `CHARGING` / `ERROR`, `assignedTaskId`는 미할당 시 `null`.

### 2.2 Operation — Task (Job → Task 진행 상황)

```json
{
  "timestamp": "2026-07-10T09:10:41.201Z",
  "module": "Operation",
  "type": "TASK_UPDATE",
  "jobId": "JOB-2026-000112",
  "taskId": "TASK-2026-000481",
  "taskSeq": 1,
  "taskType": "MOVE_TO_UNLOAD",
  "amrId": "AMR-03",
  "origin": "NODE-A01",
  "destination": "STOCKER-04",
  "status": "IN_PROGRESS"
}
```
Job 1건(왕복)의 Task 8단계 분해는 [VCS_PROJECT_OVERVIEW.md](VCS_PROJECT_OVERVIEW.md) 2번 참고.

### 2.3 JobAssign

```json
{
  "timestamp": "2026-07-10T09:10:40.955Z",
  "module": "JobAssign",
  "type": "TASK_ASSIGNED",
  "jobId": "JOB-2026-000112",
  "taskId": "TASK-2026-000481",
  "candidateAmrIds": ["AMR-01", "AMR-03", "AMR-07"],
  "assignedAmrId": "AMR-03",
  "reason": "IDLE · 최근접 · 배터리 82%"
}
```

### 2.4 PathSearch

```json
{
  "timestamp": "2026-07-10T09:10:41.050Z",
  "module": "PathSearch",
  "type": "PATH_RESULT",
  "taskId": "TASK-2026-000481",
  "origin": "NODE-A01",
  "destination": "STOCKER-04",
  "algorithm": "DIJKSTRA",
  "path": ["NODE-A01", "NODE-A05", "NODE-A09", "NODE-A13", "STOCKER-04"],
  "distanceM": 42.7,
  "estimatedTimeSec": 53
}
```

### 2.5 HostInterface

상위 시스템 newAMOS와 주고받는 내용 그대로 로그화 — Job을 받는 시점과, 진행상태/완료/고장을 보고하는 시점.

```json
{
  "timestamp": "2026-07-10T09:10:38.700Z",
  "module": "HostInterface",
  "type": "JOB_RECEIVED",
  "jobId": "JOB-2026-000112",
  "sourceId": "STOCKER-04",
  "targetId": "PROBER-02",
  "requestedBy": "newAMOS"
}
```
```json
{
  "timestamp": "2026-07-10T09:15:12.330Z",
  "module": "HostInterface",
  "type": "JOB_REPORTED",
  "jobId": "JOB-2026-000112",
  "amrId": "AMR-03",
  "reportType": "FAULT",
  "detail": "AL-4821 발생으로 Task 5 중단"
}
```
`reportType`: `IN_PROGRESS` / `COMPLETED` / `FAULT`

### 2.6 UnitDevice — 충전소 상태

```json
{
  "timestamp": "2026-07-10T09:11:00.010Z",
  "module": "UnitDevice",
  "type": "CHARGER_STATUS",
  "chargerId": "CHG-02",
  "state": "CHARGING",
  "connectedAmrId": "AMR-07",
  "batteryLevel": 41.2
}
```
`state`: `IDLE` / `CHARGING` / `FAULT`, `connectedAmrId`는 비어있으면 `null`.

### 2.7 MapUpdater — 맵 업데이트

일시적으로만 발생하는 이벤트라 다른 모듈보다 로그 빈도가 훨씬 낮음.

```json
{
  "timestamp": "2026-07-10T08:00:05.000Z",
  "module": "MapUpdater",
  "type": "MAP_UPDATED",
  "mapVersion": "v1.4.2",
  "changeType": "EDGE_CHANGED",
  "changedNodeIds": ["NODE-A09", "NODE-A10"],
  "triggeredBy": "operator:kim"
}
```
`changeType`: `NODE_ADDED` / `NODE_REMOVED` / `EDGE_CHANGED` / `FULL_RELOAD`

### 2.8 ParameterManagement — 파라미터 변경

```json
{
  "timestamp": "2026-07-10T08:30:00.000Z",
  "module": "ParameterManagement",
  "type": "PARAM_CHANGED",
  "paramKey": "AMR_MAX_SPEED",
  "oldValue": "1.0",
  "newValue": "0.8",
  "changedBy": "operator:kim"
}
```

### 2.9 NATS — 별도 로그 없음 (결정)

NATS는 모듈 간 메시지를 중계하는 브로커일 뿐 자체 도메인 이벤트가 없다. 다른 7개 모듈이 이미 각자 로그를 남기므로 NATS만의 로그 타입은 만들지 않는다. 다만 브로커 자체의 헬스(연결 끊김, 큐 적체)는 이 도구가 아니라 별도 인프라 모니터링 영역으로 남겨둔다 (필요해지면 추후 `BROKER_HEALTH` 같은 운영 지표로 분리 검토).

## 3. 표준 로그 포맷 (가장 중요한 선행 작업)

지금 모듈마다 로그 형식이 제각각인 게 가장 큰 문제. **공통 봉투(envelope) + 타입별 payload**로 구조를 통일하는 것을 제안.

### 3.1 공통 Envelope

모든 로그는 아래 필드를 반드시 포함한다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `timestamp` | ISO8601 문자열 | 로그 발생 시각 (시간대는 오픈 이슈 8번) |
| `module` | enum | `Operation` / `HostInterface` / `PathSearch` / `UnitDevice` / `MapUpdater` / `ParameterManagement` / `NATS` / `JobAssign` |
| `type` | string | 모듈별 로그 종류 (아래 3.2) |
| `correlationIds` | object | `jobId`/`taskId`/`amrId` 중 해당되는 것만 채움 — **이게 핵심**. 이게 있어야 "이 Job 하나에 관련된 모든 모듈의 로그"를 나중에 시간순으로 합쳐서 리플레이할 수 있음 |
| `payload` | object | 타입별 상세 데이터 (2번 예시의 나머지 필드들이 여기로 들어감) |

기존 2번 예시를 이 구조로 바꾸면:

```json
{
  "timestamp": "2026-07-10T09:12:03.482Z",
  "module": "Operation",
  "type": "AMR_STATUS",
  "correlationIds": { "amrId": "AMR-03", "taskId": "TASK-2026-000481" },
  "payload": {
    "position": { "x": 128.4, "y": 56.2, "nodeId": "NODE-A17" },
    "state": "RUNNING",
    "battery": 76.5
  }
}
```

### 3.2 모듈별 `type` 정의

| 모듈 | type | 발생 빈도 |
|---|---|---|
| Operation | `AMR_STATUS`, `TASK_UPDATE` | 매우 높음 (주기적) |
| JobAssign | `TASK_ASSIGNED` | Task 생성 시마다 |
| PathSearch | `PATH_RESULT` | Task 생성 시마다 |
| HostInterface | `JOB_RECEIVED`, `JOB_REPORTED` | Job 단위 (낮음) |
| UnitDevice | `CHARGER_STATUS` | 중간 (충전소 상태 변화 시) |
| MapUpdater | `MAP_UPDATED` | 매우 낮음 (맵 변경 시에만) |
| ParameterManagement | `PARAM_CHANGED` | 매우 낮음 (설정 변경 시에만) |
| NATS | (없음) | 자체 도메인 로그 없음 — 2.9 참고 |

세부 payload 필드는 2번(예시 로그) 참고. 8개 모듈 담당자와 실제 코드 기준으로 최종 확인은 필요하지만, 어제 정리한 모듈별 역할([VCS_PROJECT_OVERVIEW.md](VCS_PROJECT_OVERVIEW.md) 5번)로 1차 초안은 이걸로 확정.

### 3.3 REST 수집 엔드포인트

각 모듈이 파일 대신 아래로 로그를 전송.

```
POST /api/logs
Content-Type: application/json

{ ...위 3.1 envelope 구조 1건... }
```

- **배치 전송도 지원** — Operation의 `AMR_STATUS`처럼 주기적으로 계속 나오는 로그는 매번 개별 요청을 보내면 요청 수가 많아지므로, 배열로 묶어 보내는 것도 허용:
  ```
  POST /api/logs/batch
  [ {...}, {...}, {...} ]
  ```
- 수신한 로그는 Log Collector가 `module` + `type`에 맞는 스키마로 검증 후 저장 (4번 아키텍처 참고).

## 4. 시스템 아키텍처

```
[Operation] [JobAssign] [PathSearch] [HostInterface] [UnitDevice] [MapUpdater] [ParameterManagement]
      │            │            │             │              │            │              │
      └────────────┴────────────┴──────┬──────┴──────────────┴────────────┴──────────────┘
                                        │ POST /api/logs (REST)
                                        ▼
                            ┌───────────────────────┐
                            │   Log Collector         │  ── envelope 검증 + Oracle DB 저장
                            └───────────┬─────────────┘
                                        │
                     ┌──────────────────┴───────────────────┐
                     ▼                                       ▼
        ┌─────────────────────┐                 ┌─────────────────────────┐
        │  조회 API (리플레이용) │                 │  실시간 스트림 (WebSocket) │
        └──────────┬───────────┘                 └────────────┬─────────────┘
                    │                                          │
                    └────────────────┬─────────────────────────┘
                                      ▼
                     ┌───────────────────────────────┐
                     │  프론트엔드 — 맵 + 타임라인 뷰어    │
                     │  (.dat 맵 파일 로드 + AMR 궤적 렌더링) │
                     └───────────────────────────────┘
```

- 맵은 `.dat` 파일 포맷 (포맷 스펙은 추후 전달받음 — 8번 오픈 이슈). 파서를 별도 `MapLoader`로 분리해 두면, 정확한 바이트 포맷이 나중에 확정돼도 파서 구현부만 교체하면 되도록 설계.
- 8개 모듈이 이미 NATS(메시지 브로커)로 서로 통신하고 있으므로, REST 대신 NATS에 로그 토픽을 publish하고 Log Collector가 구독하는 방식도 대안으로 고려할 수 있음 — 다만 이번엔 요청하신 대로 REST 수집을 기본안으로 설계.

## 5. 기능 목록

**우선순위 결정**: 실시간 모니터링과 리플레이(디버깅) 둘 다 만든다 — 다만 **실시간을 먼저** 구현한다. 그래서 핵심 뷰(맵/시계열/간트차트)는 처음부터 "실시간 스트림 모드"를 기본값으로 만들고, 같은 화면에 시간 범위를 지정하면 과거를 조회하는 "리플레이 모드"를 나중에 얹는 구조로 설계한다 (뷰를 두 벌 만들지 않아도 됨).

### 5.1 핵심 모듈 (Must-have)

| # | 기능 | 설명 |
|---|---|---|
| A | 표준 로그 수집 파이프라인 | 8개 모듈 → REST → Log Collector → Oracle 저장. 3번 표준 포맷 기반 |
| B | 실시간 라이브 맵 뷰 | `.dat` 맵 위에 지금 이 순간 AMR들의 위치/상태를 실시간으로 표시 (WebSocket). **가장 먼저 구현** |
| C | AMR 상태 시계열 뷰 | AMR별 배터리/상태 변화를 시간순 그래프로. 기본은 최근 N분 실시간, 시간 범위 지정 시 과거 조회 |
| D | Job/Task 간트차트 | Job 1건이 8개 Task로 어떻게 진행됐는지, 어느 AMR이 언제 맡았는지. 진행 중인 Job은 실시간 갱신 |
| E | 맵 기반 AMR 이동 리플레이 | B와 같은 맵 컴포넌트에 시간 슬라이더를 추가해 과거 특정 구간을 재생 |

### 5.2 확장 기능

| # | 기능 | 설명 |
|---|---|---|
| 1 | 계획 경로 vs 실제 궤적 오버레이 | PathSearch 결과(계획 경로)와 AMR_STATUS 궤적(실제 이동)을 맵 위에 겹쳐서 이탈/우회 확인. 실시간·리플레이 모두 적용 |
| 2 | JobAssign 의사결정 뷰 | 후보 AMR들과 비교해 왜 이 AMR이 선택됐는지 시각화 |
| 3 | HostInterface 연동 타임라인 | newAMOS로부터 Job을 받은 시점 ~ 완료/고장 보고 시점까지를 Job 단위로 한눈에 |
| 4 | 충전소(UnitDevice) 현황판 | 충전소별 상태(IDLE/CHARGING/FAULT)와 대기 중인 AMR을 별도 패널로 |
| 5 | 이상 구간 하이라이트 | 정체 구간, 저배터리 상태로 이동 중인 AMR 등을 자동 강조 |

## 6. 데이터 모델

| 테이블 | 설명 |
|---|---|
| `LOG` | 모든 모듈 로그를 한 테이블에 저장 (공통 envelope 그대로 매핑) |
| `MAP_NODE` / `MAP_EDGE` (가칭) | `.dat` 맵 파서가 파싱한 결과를 저장 — 포맷 확정 후 설계 |

**LOG** 주요 컬럼: `id`, `ts`, `module`, `log_type`, `job_id`(nullable), `task_id`(nullable), `amr_id`(nullable), `payload`(CLOB/JSON) — `job_id`/`task_id`/`amr_id`에 인덱스를 걸어 리플레이 조회(특정 Job/AMR 기준 시간순 조회)를 빠르게.

## 7. 비기능 요구사항

- 폐쇄망 환경 (기존 SEMES 프로젝트들과 동일).
- `AMR_STATUS`처럼 주기가 짧은 로그는 트래픽이 많을 수 있음 — 배치 전송(3.3) + Log Collector의 처리량을 프로토타입 단계에서 실측 필요.
- 리플레이 조회 성능을 위해 `job_id`/`amr_id`/`ts` 기준 인덱스 필수.

## 8. 오픈 이슈 (확인 필요)

- [ ] `.dat` 맵 파일의 실제 포맷 스펙 (전달 예정)
- [ ] 로그 REST 전송 시 배치 크기/주기 — `AMR_STATUS` 트래픽 규모(AMR 대수 × 주기) 실측 필요. 특히 실시간 뷰(B)를 먼저 만들기로 했으므로 이 부분이 초반부터 성능에 직결됨
- [ ] `timestamp` 시간대 통일 (UTC vs KST) 및 각 모듈 서버 간 시계 동기화 여부
- [ ] 로그 보존 기간 (Oracle DB 용량 고려 — 리플레이용 원본은 얼마나 남길지)
- [ ] 3.2에서 1차로 정의한 모듈별 `type`/payload는 실제 코드/담당자 확인 후 최종 확정 필요

**해결된 사항**: 우선순위(실시간 먼저, 리플레이 나중), 나머지 4개 모듈의 로그 타입 1차 정의(2.5~2.8), NATS는 별도 로그 없음(2.9).

## 9. 향후 진행 순서 (제안)

1. 표준 포맷 확정 (timestamp 시간대 등 남은 오픈 이슈 먼저 정리)
2. Log Collector 스파이크 — Operation의 `AMR_STATUS`만으로 REST 수집 → 최소 구현, 트래픽 실측
3. **실시간 라이브 맵 뷰(B) 먼저 구현** — `.dat` 맵 포맷 전달받는 대로 `MapLoader` + WebSocket 스트림으로 AMR 위치 실시간 표시
4. AMR 상태 시계열(C), Job/Task 간트차트(D) 추가 — 실시간 기본 + 시간 범위 조회 옵션
5. 같은 맵 컴포넌트에 시간 슬라이더를 얹어 리플레이(E) 완성
6. 나머지 확장 기능(1~5) 순차 적용

## 10. 기술 스택 (제안)

| 계층 | 언어 | 프레임워크/주요 라이브러리 |
|---|---|---|
| DB | - | Oracle Database |
| Log Collector | Java 또는 Python | REST 수신 + 검증 + 저장 (Spring Boot 또는 FastAPI) |
| 프론트엔드 | TypeScript | React + Next.js, 맵/궤적 렌더링은 Canvas 또는 WebGL(예: PixiJS), 차트는 Recharts/ECharts |
| 실시간 스트림 | - | WebSocket (또는 SSE) |

---

*이 문서는 [DESIGN.md](DESIGN.md), [VCS_TROUBLESHOOTING_DESIGN.md](VCS_TROUBLESHOOTING_DESIGN.md)와 별개의 대안 아이디어로 작성됨.*
