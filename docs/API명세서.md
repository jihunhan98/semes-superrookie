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

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| POST | `/api/requirements/import` | 고객 요구서(docx) 표 파싱 | `file` (multipart) | `200` [{분류, 내용, 비고}] |
| POST | `/api/requirements` | 요구사항 등록(상태=접수) | `projectId`*num · `분류`str · `내용`*str · `비고`str | `201` {id, state:received} |
| GET | `/api/requirements` | 목록(필터) | `projectId`*num · `assignee`str · `state`str (query) | `200` [{id, title, state, version, assignee}] |
| POST | `/api/analyze` | AI 검토(불명확·상충 검출) | `내용`*str · `비고`str | `200` {findings[], conflicts[]} |
| POST | `/api/requirements/{id}/confirm` | 수정 확정 → 새 버전 | `본문`*str · `변경사유`*str · `변경유형`str(major\|minor\|patch) | `200` {version, state:confirmed} |
| GET | `/api/requirements/{id}/versions` | 버전 이력 | — | `200` [{version, author, reason, type, at}] |
| GET | `/api/requirements/{id}/compare` | 버전 diff | `base`*str · `head`*str (query) | `200` {diff} |

---

## 3. 기능 3 — 산출물 도출

| 메서드 | 경로 | 설명 | 요청 | 응답 |
|---|---|---|---|---|
| POST | `/api/requirements/{id}/derive` | 개발 이슈 N + 4종 도출 | — | `201` {issues[]} |
| GET | `/api/issues/{id}` | 개발 이슈 + 하위 산출물 | — | `200` {issue, artifacts[]} |
| PATCH | `/api/artifacts/{id}` | 산출물 편집·확정 | `body`str | `200` |
| GET | `/api/trace` | 요구사항↔산출물 추적 | `reqId`*str (query) | `200` {requirement, issues[], artifacts[]} |
