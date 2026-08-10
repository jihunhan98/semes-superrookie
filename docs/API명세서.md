# API 명세서

Base: `/api`. 세션/토큰 없음 — 로그인은 일치 확인만 하고, 이후 요청은 사용자 식별자(userId/사번)를 함께 보낸다.

---

## 1. 기능 1 — 로그인 · 프로젝트 관리

| 메서드 · 경로 | 설명 | 요청 | 응답 |
|---|---|---|---|
| POST `/api/signup` | 회원가입 | `{사번, 이름, 부서, 비밀번호}` | 201 / 409(사번 중복) |
| POST `/api/login` | 로그인 | `{사번, 비밀번호}` | 200 `{user}` / 401 |
| GET `/api/projects?userId=` | 내 프로젝트 목록 | — | 200 `[project]` |
| POST `/api/projects` | 프로젝트 생성 | `{이름, 고객사, 설명, modules, ownerId}` | 201 `{project, token}` |
| POST `/api/projects/join` | 토큰으로 참여 | `{token, userId}` | 200 `{project}` / 404 |
| GET `/api/projects/{id}` | 프로젝트 상세 | — | 200 `{project, members, modules}` |
| PATCH `/api/projects/{id}` | 기본정보·모듈 수정 | `{이름?, 고객사?, 설명?, modules?}` | 200 |
| POST `/api/projects/{id}/token` | 토큰 재발급 | — | 200 `{token}` |
| GET `/api/projects/{id}/members` | 멤버 목록 | — | 200 `[member]` |

---

## 2. 기능 2 — 요구사항 검토

| 메서드 · 경로 | 설명 | 요청 | 응답 |
|---|---|---|---|
| POST `/api/requirements/import` | 고객 요구서(docx) 파싱 | file(multipart) | 200 `[{분류,내용,비고}]` |
| POST `/api/requirements` | 요구사항 등록(상태=접수) | `{projectId, 분류, 내용, 비고}` | 201 `{requirement}` |
| GET `/api/requirements?projectId=&assignee=&state=` | 목록 | — | 200 `[requirement]` |
| POST `/api/analyze` | AI 검토(불명확·상충 검출) | `{내용, 비고}` | 200 `{findings[], conflicts[]}` |
| POST `/api/requirements/{id}/confirm` | 수정 확정 → 새 버전 | `{본문, 변경사유, 변경유형}` | 200 `{version}` |
| GET `/api/requirements/{id}/versions` | 버전 이력 | — | 200 `[version]` |
| GET `/api/requirements/{id}/compare?base=&head=` | 버전 diff | — | 200 `{diff}` |

---

## 3. 기능 3 — 산출물 도출

| 메서드 · 경로 | 설명 | 요청 | 응답 |
|---|---|---|---|
| POST `/api/requirements/{id}/derive` | 개발 이슈 N + 4종 도출 | — | 201 `{issues[]}` |
| GET `/api/issues/{id}` | 개발 이슈 + 하위 산출물 | — | 200 `{issue, artifacts}` |
| PATCH `/api/artifacts/{id}` | 산출물 편집·확정 | `{body}` | 200 |
| GET `/api/trace?reqId=` | 요구사항↔산출물 추적 | — | 200 `{links}` |
