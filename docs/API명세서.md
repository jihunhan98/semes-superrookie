# API 명세서

Base URL `/api` · 형식 `application/json` · 세션/토큰 없음(로그인은 일치 확인만, 이후 요청에 `userId`/사번 동봉).
표기: `*`=필수 · 타입 `str`(문자) `num`(숫자) `arr`(배열) · 요청은 별도 표기 없으면 JSON Body · 응답은 `상태코드 {형태}`.

---

## 1. 기능 1 — 로그인 · 프로젝트 관리

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| POST | `/api/signup` | 회원가입 | `empNo`*str · `name`*str · `dept`str · `password`*str | `201` {id, empNo, name, dept}<br>`409` 사번 중복 |
| POST | `/api/login` | 로그인 | `empNo`*str · `password`*str | `200` {id, empNo, name, dept}<br>`401` 불일치 |
| GET | `/api/projects` | 내 프로젝트 목록 | `userId`*num (query) | `200` [{id, name, customer, description, role, memberCount}] |
| POST | `/api/projects` | 프로젝트 생성(생성자=Owner, 토큰 발급) | `userId`*num · `name`*str · `customer`str · `description`str | `201` {id, name, customer, description, role, token, members[]} |
| POST | `/api/projects/join` | 토큰으로 참여(이미 멤버면 그대로) | `userId`*num · `token`*str | `200` {id, name, customer, description, role, memberCount}<br>`400` 잘못/폐기된 토큰 |
| GET | `/api/projects/{id}` | 프로젝트 상세(설정 화면) | `userId`*num (query) | `200` {id, name, customer, description, role, token, members[]}<br>(`token`은 Owner에게만 채워짐)<br>`404` 프로젝트 없음 · `403` 멤버 아님 |
| PATCH | `/api/projects/{id}` | 기본정보 수정(Owner) | `userId`*num · `name`*str · `customer`str · `description`str | `200` (상세와 동일 형태)<br>`403` 권한 없음 |
| POST | `/api/projects/{id}/token/reissue` | 토큰 재발급(Owner, 이전 폐기) | `userId`*num (query) | `200` {token}<br>`403` 권한 없음 |

> 멤버 목록은 별도 엔드포인트 없이 `GET /api/projects/{id}` 응답의 `members[]`에 포함된다.
> UI상 "멤버 초대" 버튼은 별도 API 호출 없이 상세 응답에 이미 담겨온 `token`을 화면에 노출·복사하는 동작이고, "재발급"을 눌러야 `/token/reissue`가 호출된다.

---

## 2. 기능 2 — 요구사항 검토

요구사항 API는 모두 프로젝트 하위 경로다. 인증이 없으므로 `userId`를 항상 함께 보낸다.

### 2.1 구현 완료

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| POST | `/api/projects/{projectId}/requirements` | 요구사항 등록 — **저장 + AI 초기 검토를 동기로 함께 수행**(그래서 화면에 로딩이 뜬다) | `userId`*num · `reqKey`*str · `content`*str · `requesterDept`str · `requesterName`str | `201` 상세 응답(아래)<br>`409` 요구사항 ID 중복<br>`403` 멤버 아님 |
| GET | `/api/projects/{projectId}/requirements` | 목록(플랫 · 분류 그룹 없음) | `userId`*num (query) | `200` [{id, reqKey, content, state, stateLabel, version, assigneeId, assigneeName, findingCount, updatedAt}] |
| GET | `/api/projects/{projectId}/requirements/assignees` | 담당자 필터 후보(프로젝트 멤버 전원) | `userId`*num (query) | `200` [{userId, name}] |
| GET | `/api/projects/{projectId}/requirements/{reqId}` | 상세 — AI 검토 결과와 draft 포함 | `userId`*num (query) | `200` 상세 응답(아래)<br>`404` 없음 |
| POST | `/api/projects/{projectId}/requirements/{reqId}/analyze` | AI 재분석("↻ 다시 분석") — 기존 검출을 지우고 다시 저장 | `userId`*num (query) | `200` 상세 응답(아래) |

**상세 응답**

```jsonc
{
  "id": 1, "projectId": 1, "reqKey": "req-am-03",
  "content": "AMR 매칭 시 가용한 AMR 중 가장 가까운 AMR을 선택한다.",   // 등록 원문
  "requesterDept": "삼성전자 EDS · 설비공정그룹", "requesterName": "김민석 책임",
  "state": "RECEIVED", "stateLabel": "접수", "version": null,
  "assigneeId": 1, "assigneeName": "한지훈",
  // AI 제안이 이미 반영된 문장 — 확정 화면의 "확정될 본문"에 그대로 채워진다.
  "aiDraftContent": "AMR 매칭 시 IDLE 상태이며 SoC 최소값 이상인 AMR 중 …",
  "aiEngine": "ok",                                    // ok | unavailable
  "findings": [                                        // 화면에서 읽기 전용으로만 표시
    { "findingType": "정량 기준 부재", "targetSpan": "가용한 AMR",
      "reason": "…", "suggestion": "…", "conflictReqKey": null }
  ],
  "createdAt": "2026-08-17 09:10", "updatedAt": "2026-08-17 09:12"
}
```

> **AI 제안에는 "적용" API가 없다.** 백엔드가 `aiDraftContent`로 제안이 반영된 문장을 이미
> 만들어 내려주고, 프론트는 그 값을 본문 입력칸의 초기값으로 쓴다. 사용자는 그 텍스트를
> 그대로 두거나 직접 고치거나 `content`(등록 원문)로 되돌린다.

> **AI 서버가 죽어 있어도 등록은 된다.** 이 경우 `findings`는 빈 배열, `aiDraftContent`는
> 원문과 같고 `aiEngine`이 `unavailable`이 된다. 나중에 "다시 분석"으로 재요청할 수 있다.

### 2.2 미구현 (다음 단계)

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/projects/{projectId}/requirements/{reqId}/diff-analyze` | 확정본 수정 시 **변경분만** AI 검토 |
| POST | `/api/projects/{projectId}/requirements/{reqId}/consensus` | 고객 합의 기록(방법·담당자·일자·내용) |
| POST | `/api/projects/{projectId}/requirements/{reqId}/confirm` | 확정 → 새 버전 (합의 기록 없으면 거부) |
| GET | `/api/projects/{projectId}/requirements/{reqId}/versions` | 버전 이력 |
| GET | `/api/projects/{projectId}/requirements/{reqId}/compare` | 버전 diff |
| GET/PUT | `/api/projects/{projectId}/requirement-fields` | 프로젝트별 요구사항 항목 구성 |

### 2.3 AI 서버 (`ai-model`, FastAPI · 기본 8001)

백엔드만 이 서버를 호출한다. 프론트는 직접 호출하지 않는다.

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| POST | `/analyze` | 불명확·상충 검출 + 제안 반영 문장 생성 | `content`*str · `baseContent`str · `reason`str · `existing`[{reqKey, content}] | `200` {findings[], draftContent, engine, scope, elapsedMs} |
| GET | `/health` | 상태 + Ollama 연결 여부 | — | `200` {status, ollama, model} |
| GET | `/types` | 검출 유형 목록 | — | `200` {types[]} |

- `baseContent`가 있으면 `scope: "diff"` — 바뀐 부분과 사유만 검토한다(확정본 수정).
- 없으면 `scope: "full"` — 본문 전체를 검토한다(최초 확정).
- `engine`은 `rule`(규칙 기반) 또는 `llm`(Ollama 병용). Ollama가 없어도 항상 동작한다.

---

## 3. 기능 3 — 산출물 도출

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| POST | `/api/requirements/{id}/derive` | 개발 이슈 N + 4종 도출 | — | `201` {issues[]} |
| GET | `/api/issues/{id}` | 개발 이슈 + 하위 산출물 | — | `200` {issue, artifacts[]} |
| PATCH | `/api/artifacts/{id}` | 산출물 편집·확정 | `body`str | `200` |
| GET | `/api/trace` | 요구사항↔산출물 추적 | `reqId`*str (query) | `200` {requirement, issues[], artifacts[]} |
