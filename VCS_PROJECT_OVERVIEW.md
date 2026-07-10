# VCS 프로젝트 개요 (기준 문서)

> 이 문서는 VCS 프로젝트의 배경/구조를 기록한 **기준 정보**다. 특정 기능(예: 알람 트러블슈팅 어시스턴트, [VCS_TROUBLESHOOTING_DESIGN.md](VCS_TROUBLESHOOTING_DESIGN.md))을 설계할 때는 이 문서의 내용을 전제로 한다.

## 1. 사업 배경

- **SEMES**(우리)가 **삼성전자 EDS 설비공정그룹**(고객사)과 진행하는 프로젝트.
- 목표: 반도체 **후공정 EDS 라인**에 **AMR 자동화 시스템**을 구축하는 것.

## 2. Task (AMR이 수행하는 이송 작업)

AMR이 옮기는 대상은 **Probe Card**이며, Stocker와 Prober 사이를 왕복한다.

| 방향 | 설명 |
|---|---|
| Stocker → Prober | EDS 테스트를 진행해야 하는 Probe Card를 투입 |
| Prober → Stocker | EDS 테스트가 끝난 Probe Card를 회수 |

newAMOS가 VCS에게 "Stocker에서 PCard 빼서 Prober에 넣고, EDS 테스트가 끝나면 다시 Prober에서 빼서 Stocker에 넣어라"라고 명령하면(Job), VCS는 이를 Task 단위로 쪼갠다. 왕복 1회(Job 1건)는 아래처럼 8개 Task로 구성된다.

| seq | taskType | 설명 |
|---|---|---|
| 1 | MOVE_TO_UNLOAD | AMR이 Stocker까지 이동 |
| 2 | UNLOAD | Stocker에서 PCard를 빼서 AMR에 싣기 |
| 3 | MOVE_TO_LOAD | AMR이 Prober까지 이동 |
| 4 | LOAD | Prober에 PCard 투입 (→ EDS 테스트 시작) |
| 5 | MOVE_TO_UNLOAD | (테스트 종료 후) AMR이 Prober까지 이동 |
| 6 | UNLOAD | Prober에서 PCard를 빼서 AMR에 싣기 |
| 7 | MOVE_TO_LOAD | AMR이 Stocker까지 이동 |
| 8 | LOAD | Stocker에 PCard 반납 |

## 3. 시스템 계층 구조 (3-tier)

```
newAMOS (삼성전자, 상위 시스템 · MES 역할)
   │  Task 할당
   ▼
VCS (세메스, 중간 계층)
   │  유휴 상태인 AMR에게 Task 할당 + 출발지→목적지 경로탐색
   ▼
AMR (실제 이송 로봇, 다수 대)
   │  상태값을 VCS에 지속 보고
   ▼
VCS ── 고장 발생 시 newAMOS로 보고
```

- **newAMOS**: 삼성전자 소유의 상위 시스템. MES 역할을 하며 전체 Task를 관리하고 VCS에 Task를 할당한다.
- **VCS**: newAMOS로부터 Task를 받으면, 현재 작업 중이지 않은(유휴) AMR을 골라 해당 Task를 할당한다. 출발지 노드 → 목적지(dest) 노드로 경로 탐색을 수행해 AMR이 Probe Card를 옮기게 한다. AMR로부터 상태값을 계속 수신·점검하고, 고장 발생 시 newAMOS로 보고한다.
- **AMR**: 실제로 Probe Card를 물리적으로 이송하는 로봇. 다수 대가 동시에 운용된다.

## 4. VCS 내부 구성 — UI vs APP

VCS는 **UI**와 **APP**으로 나뉜다.

- **VCS UI**: 고객사(삼성전자)가 주로 사용하는 화면. 로직은 없고 표시/조작 전담.
  - 실제 스펙: Java 1.7.0_80 (32bit) + SWT 데스크톱 앱 (자세한 제약은 [VCS_TROUBLESHOOTING_DESIGN.md](VCS_TROUBLESHOOTING_DESIGN.md) 2번 참고).
- **VCS APP**: 실제 로직을 전담하는 백엔드.
  - 실제 스펙: Java 21 기반 MSA, 총 8개 모듈.

## 5. VCS APP — MSA 모듈 구성 (8개)

| # | 모듈 | 역할 |
|---|---|---|
| 1 | **Operation** | 가장 핵심적인 모듈. AMR과 주기적으로 통신(상태값 수신·점검)하고 Task를 관리한다. 다른 모듈들이 서로 통신할 때도 Operation을 거친다. |
| 2 | **HostInterface** | 상위 시스템 newAMOS와 통신하는 인터페이스. |
| 3 | **PathSearch** | 출발지 노드와 목적지 노드가 정해지면 다익스트라 알고리즘으로 경로를 계산해 알려준다. |
| 4 | **UnitDevice** | AMR 충전소와 통신 — 충전 중 여부, 고장 여부 등을 확인한다. |
| 5 | **MapUpdater** | 라인 맵 업데이트 전담. 상시 동작이 아니라 필요 시 일시적으로 동작한다. |
| 6 | **ParameterManagement** | 시스템 파라미터 관리 모듈. |
| 7 | **NATS** | MSA 구조 내 모듈 간 통신을 담당하는 메시지 브로커. |
| 8 | **JobAssign** | AMR에게 실제 작업(Task)을 할당하는 모듈. |

## 6. 데이터베이스

- Oracle DB 사용.

---

*이 문서는 프로젝트 전체 맥락을 담은 기준 문서이며, 개별 기능 설계 문서([DESIGN.md](DESIGN.md), [VCS_TROUBLESHOOTING_DESIGN.md](VCS_TROUBLESHOOTING_DESIGN.md))는 이 내용을 전제로 작성된다.*
