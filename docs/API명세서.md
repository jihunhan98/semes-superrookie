# API 명세서

Base URL `/api` · 형식 `application/json` · 세션/토큰 없음(로그인은 일치 확인만, 이후 요청에 `userId`/사번 동봉).
각 엔드포인트를 **클릭하면 펼쳐집니다**(요청·응답 상세). GitHub에서 토글로 렌더링됩니다.

---

## 1. 기능 1 — 로그인 · 프로젝트 관리

<details>
<summary><b>POST</b> <code>/api/signup</code> — 회원가입</summary>

사번·비밀번호로 계정을 생성한다.

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|---|---|:--:|---|
| empNo | string | ✓ | 사번(로그인 아이디) |
| name | string | ✓ | 이름 |
| dept | string |  | 부서 |
| password | string | ✓ | 비밀번호(평문 전송, 서버에서 해시) |

```json
{ "empNo": "20213456", "name": "한지훈", "dept": "VCS 개발파트", "password": "secret123" }
```

**Responses**

- `201 Created`
```json
{ "id": 12, "empNo": "20213456", "name": "한지훈", "dept": "VCS 개발파트" }
```
- `409 Conflict` — 사번 중복 · `400 Bad Request` — 필수값 누락
</details>

<details>
<summary><b>POST</b> <code>/api/login</code> — 로그인</summary>

사번·비밀번호 일치만 확인한다(세션/토큰 발급 없음).

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|---|---|:--:|---|
| empNo | string | ✓ | 사번 |
| password | string | ✓ | 비밀번호 |

```json
{ "empNo": "20213456", "password": "secret123" }
```

**Responses**

- `200 OK`
```json
{ "id": 12, "empNo": "20213456", "name": "한지훈", "dept": "VCS 개발파트" }
```
- `401 Unauthorized` — 사번/비밀번호 불일치
</details>

<details>
<summary><b>GET</b> <code>/api/projects?userId=</code> — 내 프로젝트 목록</summary>

로그인 사용자가 참여(Owner/Member)한 프로젝트 목록.

**Query**

| 파라미터 | 타입 | 필수 | 설명 |
|---|---|:--:|---|
| userId | number | ✓ | 사용자 id |

**Responses**

- `200 OK`
```json
[
  { "id": 1, "name": "VCS · 태스크 할당", "customer": "삼성전자 EDS",
    "role": "OWNER", "reqCount": 24, "confirmedCount": 18, "lastOpenedAt": "2026-08-10T09:00:00" }
]
```
</details>

<details>
<summary><b>POST</b> <code>/api/projects</code> — 프로젝트 생성</summary>

새 프로젝트 생성. 생성자는 OWNER가 되고 접근 토큰이 발급된다.

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|---|---|:--:|---|
| name | string | ✓ | 프로젝트명 |
| customer | string |  | 고객사 |
| description | string |  | 설명 |
| modules | string[] |  | 대상 VCS 모듈 |
| ownerId | number | ✓ | 생성자(사용자 id) |

```json
{ "name": "VCS · 태스크 할당", "customer": "삼성전자 EDS",
  "description": "태스크 할당 영역", "modules": ["jobassign","pathsearch"], "ownerId": 12 }
```

**Responses**

- `201 Created`
```json
{ "project": { "id": 1, "name": "VCS · 태스크 할당", "role": "OWNER" },
  "token": "req_prj_9f3a2c7b1e4d" }
```
</details>

<details>
<summary><b>POST</b> <code>/api/projects/join</code> — 토큰으로 참여</summary>

접근 토큰으로 기존 프로젝트에 MEMBER로 합류한다.

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|---|---|:--:|---|
| token | string | ✓ | 프로젝트 접근 토큰 |
| userId | number | ✓ | 참여자(사용자 id) |

**Responses**

- `200 OK` — `{ "project": { "id": 1, "name": "...", "role": "MEMBER" } }`
- `404 Not Found` — 잘못/폐기된 토큰
</details>

<details>
<summary><b>GET</b> <code>/api/projects/{id}</code> — 프로젝트 상세</summary>

**Path** `id`(number) — 프로젝트 id

**Responses** — `200 OK`
```json
{ "project": { "id": 1, "name": "VCS · 태스크 할당", "customer": "삼성전자 EDS", "description": "..." },
  "members": [ { "userId": 12, "name": "한지훈", "role": "OWNER" } ],
  "modules": ["jobassign","pathsearch"] }
```
</details>

<details>
<summary><b>PATCH</b> <code>/api/projects/{id}</code> — 기본정보·모듈 수정 (Owner)</summary>

**Path** `id`(number) · **Request Body**(수정할 필드만)

| 필드 | 타입 | 설명 |
|---|---|---|
| name | string | 프로젝트명 |
| customer | string | 고객사 |
| description | string | 설명 |
| modules | string[] | 대상 모듈 |

**Responses** — `200 OK` / `403 Forbidden`(Owner 아님)
</details>

<details>
<summary><b>POST</b> <code>/api/projects/{id}/token</code> — 토큰 재발급 (Owner)</summary>

이전 토큰을 폐기하고 새 토큰을 발급한다.

**Responses** — `200 OK` `{ "token": "req_prj_1a2b3c4d5e6f" }` / `403 Forbidden`
</details>

<details>
<summary><b>GET</b> <code>/api/projects/{id}/members</code> — 멤버 목록</summary>

**Responses** — `200 OK`
```json
[ { "userId": 12, "name": "한지훈", "empNo": "20213456", "role": "OWNER" },
  { "userId": 15, "name": "이수민", "empNo": "20219xxx", "role": "MEMBER" } ]
```
</details>

---

## 2. 기능 2 — 요구사항 검토

<details>
<summary><b>POST</b> <code>/api/requirements/import</code> — 고객 요구서(docx) 파싱</summary>

`multipart/form-data`로 .docx 업로드 → 문서 표를 파싱해 요구사항 후보를 반환(아직 저장 전).

**Responses** — `200 OK` `[ { "분류": "태스크 전개", "내용": "...", "비고": "..." } ]`
</details>

<details>
<summary><b>POST</b> <code>/api/requirements</code> — 요구사항 등록</summary>

**Request Body** `{ projectId, 분류, 내용, 비고 }` → 상태 `접수`로 생성.
**Responses** — `201 Created` `{ "id": "req-ta-01", "state": "received" }`
</details>

<details>
<summary><b>GET</b> <code>/api/requirements?projectId=&assignee=&state=</code> — 목록</summary>

**Query** `projectId`(필수) · `assignee`(담당자 필터) · `state`(상태 필터)
**Responses** — `200 OK` `[ { "id":"req-ta-01","title":"...","state":"in_review","version":"v1.0.0","assignee":"한지훈" } ]`
</details>

<details>
<summary><b>POST</b> <code>/api/analyze</code> — AI 검토(불명확·상충 검출)</summary>

**Request Body** `{ 내용, 비고 }`
**Responses** — `200 OK`
```json
{ "findings": [ { "span": "복수의 태스크 생성 허용 여부", "type": "정량 기준 부재", "reason": "...", "suggestion": "최대 1건만 허용" } ],
  "conflicts": [ { "with": "req-ta-01", "reason": "우선순위 규칙 상이", "suggestion": "..." } ] }
```
</details>

<details>
<summary><b>POST</b> <code>/api/requirements/{id}/confirm</code> — 수정 확정 → 새 버전</summary>

**Request Body** `{ 본문, 변경사유, 변경유형(major|minor|patch) }`
**Responses** — `200 OK` `{ "version": "v1.0.2", "state": "confirmed" }`
</details>

<details>
<summary><b>GET</b> <code>/api/requirements/{id}/versions</code> · <code>/compare?base=&head=</code> — 버전 이력·diff</summary>

- `/versions` → `[ { "version":"v1.0.1","author":"한지훈","reason":"...","type":"minor","at":"..." } ]`
- `/compare?base=v1.0.0&head=v1.0.1` → `{ "diff": [ ... ] }`
</details>

---

## 3. 기능 3 — 산출물 도출

<details>
<summary><b>POST</b> <code>/api/requirements/{id}/derive</code> — 개발 이슈 N + 4종 도출</summary>

확정 요구사항에서 개발 이슈와 산출물 초안을 일괄 생성.
**Responses** — `201 Created`
```json
{ "issues": [ { "id": "AMVCS30-77", "title": "가용 AMR 매칭",
    "artifacts": { "swvoc":"AMSWV-2201","functional":"AMVCS30-92","nonfunctional":"AMVCS30-93","detailDesign":"AMVCS30-94" } } ] }
```
</details>

<details>
<summary><b>GET</b> <code>/api/issues/{id}</code> · <b>PATCH</b> <code>/api/artifacts/{id}</code> — 이슈·산출물</summary>

- `GET /api/issues/{id}` → `{ "issue": {...}, "artifacts": [ ... ] }`
- `PATCH /api/artifacts/{id}` → `{ body }` 편집·확정, `200 OK`
</details>

<details>
<summary><b>GET</b> <code>/api/trace?reqId=</code> — 요구사항↔산출물 추적</summary>

**Responses** — `200 OK` `{ "requirement": "req-ta-01", "issues": ["AMVCS30-77"], "artifacts": ["AMSWV-2201","AMVCS30-92","..."] }`
</details>
