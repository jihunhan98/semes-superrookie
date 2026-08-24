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
| POST | `/api/projects/{projectId}/requirements/{reqId}/diff-analyze` | **확정본 수정 시 AI 검토** — 확정본 대비 바뀐 부분과 사유만 본다. 확정본은 서버가 DB에서 가져오므로 보내지 않는다 | `userId`*num · `content`*str · `reason`*str | `200` 상세 응답(아래) |
| POST | `/api/projects/{projectId}/requirements/{reqId}/consensus` | **고객 합의 기록** — 확정의 전제 조건. 합의할 때마다 새로 쌓이고 확정은 마지막 기록을 근거로 삼는다 | `userId`*num · `method`*str · `customerContact`*str · `agreedOn`*str(yyyy-MM-dd) · `note`str · `agreedContent`*str | `200` 상세 응답(아래)<br>`400` 합의일 형식 오류 |
| POST | `/api/projects/{projectId}/requirements/{reqId}/confirm` | **확정** → 버전 부여(최초 v1.0.0). 본문을 확정본으로 덮어쓰고 이력에 한 줄 남긴다 | `userId`*num · `content`*str · `title`str(생략 시 "최초 확정") | `200` 상세 응답(아래)<br>`409` 합의 기록 없음 |
| GET | `/api/projects/{projectId}/requirements/{reqId}/compare` | **버전 비교** — 줄 단위 diff 를 split 뷰용으로 짝지어 반환. base/head 생략 시 "직전 ↔ 최신" | `userId`*num · `base`str · `head`str (query) | `200` {baseVersion, headVersion, headTitle, added, removed, rows[]}<br>`404` 없는 버전 |
| POST | `/api/projects/{projectId}/requirements/{reqId}/hold` | **보류** — 고객 협의가 더 필요할 때. 나중에 이어서 확정 가능 | `userId`*num (query) | `200` 상세 응답(아래) |

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
  // 어느 경로로 판정했는지.
  // llm-api(사내 LLM이 응답함) | rule(규칙 기반만 — LLM 미설정·실패) | unavailable(AI 서버 자체 미응답)
  "aiEngine": "llm-api",
  "findings": [                                        // 화면에서 읽기 전용으로만 표시
    { "findingType": "정량 기준 부재", "targetSpan": "가용한 AMR",
      "reason": "…", "suggestion": "…", "conflictReqKey": null }
  ],
  // 가장 최근 고객 합의 기록. 없으면 null — null 이면 확정할 수 없다.
  "consensus": {
    "id": 1, "method": "대면 미팅",
    "customerContact": "삼성전자 EDS 김민석 책임", "agreedOn": "2026-08-16",
    "note": "가용/최단거리 판정 기준을 위 문장대로 확정하기로 합의.",
    // 합의 시점의 본문 스냅샷. 지금 본문과 다르면 화면이 "재합의 필요"를 경고한다.
    "agreedContent": "AMR 매칭 시 IDLE 상태이며 …",
    "recordedByName": "한지훈", "createdAt": "2026-08-16 14:20",
    // 이 합의로 확정된 버전. 아직 확정에 안 쓰였으면 null — 다음 확정의 근거가 된다.
    "usedForVersion": "1.0.0"
  },
  // 아직 확정에 쓰이지 않은 합의 기록이 있으면 true.
  // "확정 전"이 아니라 "미사용 합의" 기준이다 — 확정본 수정은 이미 확정된 것을 다시
  // 확정하므로, 확정 여부로 막으면 재확정이 불가능해진다.
  "canConfirm": true,
  "nextVersion": "1.0.0",      // 확정하면 부여될 버전 — 화면의 "확정 시 v1.0.0"
  "versions": [                // 확정 이력(최신순). 확정 전에는 빈 배열
    { "id": 1, "version": "1.0.0", "title": "최초 확정",
      "content": "…확정된 본문…",
      // 이전 버전 대비 어느 자리가 올랐는지. 첫 확정은 MINOR
      "kind": "MINOR", "confirmedByName": "한지훈",
      "createdAt": "2026-08-16 14:25" }
  ],
  "createdAt": "2026-08-17 09:10", "updatedAt": "2026-08-17 09:12"
}
```

> **확정에는 반드시 합의 기록이 필요하다.** 화면에서도 버튼이 비활성화되지만, API도
> 합의 기록이 없으면 `409`로 거부한다 — "합의 없이 확정된 요구사항"이 만들어지면 안 되므로.
> 확정하면 `content`가 확정본으로 덮어써지고, 그전 문장은 `versions[]`에 남는다.

> **AI 제안에는 "적용" API가 없다.** 백엔드가 `aiDraftContent`로 제안이 반영된 문장을 이미
> 만들어 내려주고, 프론트는 그 값을 본문 입력칸의 초기값으로 쓴다. 사용자는 그 텍스트를
> 그대로 두거나 직접 고치거나 `content`(등록 원문)로 되돌린다.

> **AI 서버가 죽어 있어도 등록은 된다.** 이 경우 `findings`는 빈 배열, `aiDraftContent`는
> 원문과 같고 `aiEngine`이 `unavailable`이 된다. 나중에 "다시 분석"으로 재요청할 수 있다.
>
> `aiEngine`은 세 값을 구분해서 봐야 한다. 검출 0건의 뜻이 서로 다르기 때문이다.
>
> | `aiEngine` | 검출 0건의 뜻 | 화면 표시 |
> |---|---|---|
> | `llm-api` | 사내 LLM이 검토했고 걸린 게 없다 | 사내 LLM |
> | `rule` | LLM은 못 썼지만 규칙 검토는 돌았고 걸린 게 없다 | 규칙 기반 |
> | `unavailable` | 아무 검토도 못 했다 — 다시 분석이 필요하다 | AI 미응답 |
>
> `rule`은 "검토를 못 했다"가 **아니다.** 규칙 검출은 LLM 유무와 무관하게 항상 돌기 때문에
> `rule`이면서 검출이 여러 건일 수 있다. 이 구분이 없으면 검출이 있는데도 "AI 미응답"으로
> 보이는 앞뒤 안 맞는 표시가 나온다.

### 2.2 미구현 (다음 단계)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET/PUT | `/api/projects/{projectId}/requirement-fields` | 프로젝트별 요구사항 항목 구성 |

### 2.3 AI 서버 (`ai-model`, FastAPI · 기본 8001)

백엔드만 이 서버를 호출한다. 프론트는 직접 호출하지 않는다.

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| POST | `/analyze` | 불명확·상충 검출 + 제안 반영 문장 생성 | `content`*str · `baseContent`str · `reason`str · `existing`[{reqKey, content}] | `200` {findings[], draftContent, engine, scope, elapsedMs} |
| GET | `/health` | 사내 LLM API 주소 설정 여부 | — | `200` {status, llmApiConfigured, llmApiModel} |
| GET | `/types` | 검출 유형 목록 | — | `200` {types[]} |

- `baseContent`가 있으면 `scope: "diff"` — 바뀐 부분과 사유만 검토한다(확정본 수정).
- 없으면 `scope: "full"` — 본문 전체를 검토한다(최초 확정).

**판정 방식** — 규칙 기반 검출이 항상 먼저 실행되고, 그 위에 사내 LLM API를 한 번 더
호출해 보충한다.

| `engine` | 무엇 | 호출 규격 |
|---|---|---|
| `llm-api` | 사내 LLM API 서비스(GPT-OSS-120B)가 응답함 | OpenAI 호환 `POST {LLM_API_BASE}/chat/completions` · `Authorization: Bearer {LLM_API_KEY}` |
| `rule` | 사내 LLM 미응답(주소 미설정·연결 실패·타임아웃) — 규칙 결과만 | — |
| `unavailable` | AI 서버 자체가 응답하지 않음. 이 값은 AI 서버가 아니라 **백엔드가** 채운다 | — |

- 폐쇄망은 반출이 막혀 외부 AI API를 못 쓴다. 그래서 사내 LLM API 하나만 쓰고,
  응답하지 못해도 규칙 기반으로 항상 응답한다.
- LLM이 붙어도 **규칙 결과가 먼저**이고 LLM이 새로 찾은 것만 덧붙는다. LLM이 원문에 없는
  `targetSpan`이나 정의되지 않은 유형을 만들어내면 버린다(환각 방지).
- 주소·모델명은 소스가 아니라 환경 변수로 넘긴다 (`LLM_API_BASE` / `LLM_API_MODEL` 등,
  `ai-model/README.md` 참고).

---

## 3. 기능 3 — 산출물 도출

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| POST | `/api/requirements/{id}/derive` | 개발 이슈 N + 4종 도출 | — | `201` {issues[]} |
| GET | `/api/issues/{id}` | 개발 이슈 + 하위 산출물 | — | `200` {issue, artifacts[]} |
| PATCH | `/api/artifacts/{id}` | 산출물 편집·확정 | `body`str | `200` |
| GET | `/api/trace` | 요구사항↔산출물 추적 | `reqId`*str (query) | `200` {requirement, issues[], artifacts[]} |
