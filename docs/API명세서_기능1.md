# API 명세서 — 기능 1

세션/토큰 없음. 로그인은 일치 확인만 하고, 이후 요청은 사용자 식별자(userId 또는 사번)를 함께 보낸다.

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
