# API 명세서 (API Specification)

> 요구사항 엔지니어링 시스템 · REST API
> 상위 문서: [DESIGN](../DESIGN.md) · [기능명세서](기능명세서.md)
> 구간: **프론트엔드 ↔ 백엔드(Spring Boot)** = `/api/*` · **백엔드 ↔ AI 서버(FastAPI)** = `/ai/*`(내부)
> 초안이며 구현 단계에서 확정. 현재 개발 범위는 **기능 1**.

---

## 0. 공통 규약

- **Base URL**: `/api` (백엔드), `http://<ai-host>/ai` (AI 서버, 내부 호출)
- **형식**: 요청·응답 모두 `application/json; charset=utf-8`
- **인증**: 로그인 후 발급된 토큰을 `Authorization: Bearer <token>` 헤더로 전달 (로그인·회원가입 제외)
- **상태 코드**: `200` 성공 · `201` 생성 · `400` 잘못된 요청 · `401` 미인증 · `403` 권한없음 · `404` 없음 · `409` 충돌(중복) · `500` 서버오류
- **에러 응답(공통)**:
  ```json
  { "error": { "code": "REQ_NOT_FOUND", "message": "요구사항을 찾을 수 없습니다." } }
  ```
- **ID 규칙**: 사용자 `사번` · 요구사항 `req-xx-nn` · 버전 `vMAJOR.MINOR.PATCH` · 산출물 `AMVCS30-xx`(티켓)·`AMSWV-xxxx`(SWVOC)

---

## 1. 인증 · 사용자

### `POST /api/auth/signup` — 회원가입
```json
// req
{ "empNo": "20213123", "name": "한지훈", "password": "••••••" }
// res 201
{ "empNo": "20213123", "name": "한지훈" }
```
- `409` 사번 중복.

### `POST /api/auth/login` — 로그인
```json
// req
{ "empNo": "20213123", "password": "••••••" }
// res 200
{ "token": "eyJ...", "user": { "empNo": "20213123", "name": "한지훈" } }
```
- `401` 인증 실패.

### `GET /api/auth/me` — 현재 사용자
```json
// res 200
{ "empNo": "20213123", "name": "한지훈" }
```

---

## 2. 프로젝트 · 대시보드

### `GET /api/projects` — 프로젝트 목록
```json
// res 200
[ { "id": "vcs-task", "name": "VCS · 태스크 할당 개선", "reqCount": 24 } ]
```

### `GET /api/projects/{projectId}/dashboard` — 대시보드 요약
```json
// res 200
{
  "stats": { "total": 24, "confirmed": 18, "inReview": 6, "artifacts": 42 },
  "myTasks": [ { "reqId": "req-ta-01", "title": "태스크 할당 기준", "findings": 2 } ],
  "recentVersions": [ { "reqId": "req-mp-01", "title": "입출고지 와일드카드", "version": "v1.1.0", "author": "한지훈", "at": "2026-08-04" } ]
}
```

### `GET /api/projects/{projectId}/activity` — 활동 피드
```json
// res 200
[
  { "type": "confirm", "user": "한지훈", "reqId": "req-tf-01", "version": "v1.0.1", "at": "2026-08-04T14:30:00" },
  { "type": "review_start", "user": "이수민", "reqId": "req-ta-01", "at": "2026-08-04T12:00:00" }
]
```

---

## 3. 요구사항

### `GET /api/projects/{projectId}/requirements` — 목록
- Query: `state`(all|inReview|confirmed) · `group`(category) · `q`(검색어)
```json
// res 200 (group=category)
[
  { "category": "태스크", "items": [
    { "reqId": "req-ta-01", "title": "태스크 할당 기준", "state": "inReview", "version": null, "findings": 2, "assignee": "이수민", "updatedAt": "2026-08-02" },
    { "reqId": "req-tf-01", "title": "신규 태스크 생성", "state": "confirmed", "version": "v1.0.1", "artifacts": 4, "assignee": "한지훈", "updatedAt": "2026-08-03" }
  ]}
]
```

### `POST /api/projects/{projectId}/requirements` — 신규 등록
```json
// req
{ "category": "태스크", "content": "우선순위 순 할당…", "remark": "할당 조건은 사용자 설정에서 변경" }
// res 201
{ "reqId": "req-ta-05", "state": "inReview", "version": null }
```

### `GET /api/requirements/{reqId}` — 상세
```json
// res 200
{
  "reqId": "req-tf-01", "projectId": "vcs-task", "category": "태스크 전개",
  "title": "신규 태스크 생성", "state": "confirmed", "version": "v1.0.1",
  "content": "외부 시스템(newAMOS)으로부터 …", "remark": "동일 자재 ID …",
  "assignee": "한지훈", "artifactsCount": 4
}
```

### `PATCH /api/requirements/{reqId}` — 메타 수정
- 분류·담당자 등 메타데이터만. 본문 확정 변경은 **버전 생성(§5)** 사용.

---

## 4. 요구사항 검토 (AI 분석)

### `POST /api/requirements/{reqId}/analyze` — AI 검토 실행
```json
// req
{ "content": "…", "remark": "…", "engine": "local" }   // engine: local | playground
// res 200
{
  "mode": "ollama",                 // ollama | playground | mock
  "ambiguous": true,
  "findings": [
    { "id": "f1", "span": "복수의 태스크 생성 허용 여부", "type": "정량 기준 부재",
      "reason": "허용 개수·조건이 정의되지 않음", "suggestion": "동일 자재 ID 최대 1건만 허용" }
  ],
  "conflicts": [
    { "with": "req-ta-01", "reason": "우선순위 규칙이 상반됨", "suggestion": "req-ta-01 기준으로 통일" }
  ]
}
```
- 백엔드는 내부적으로 `POST /ai/analyze`(§8)를 호출. AI 미기동 시 `mode: "mock"`.

### `POST /api/requirements/{reqId}/findings/{findingId}/skip` — 넘어가기
```json
// req
{ "reason": "문맥상 문제 없음" }
// res 200
{ "findingId": "f1", "status": "skipped" }
```

---

## 5. 버전 (확정 · 이력 · 비교)

### `POST /api/requirements/{reqId}/versions` — 확정 → 새 버전 생성
확정(첫 확정) 및 확정본 수정(재확정) 모두 이 API로 새 버전을 만든다.
```json
// req
{
  "content": "외부 시스템(newAMOS)으로부터 인터페이스 명세서 v1.2 형식의 …",
  "remark": "…",
  "changeType": "PATCH",                     // MAJOR | MINOR | PATCH
  "message": "‘약속된 형식’을 IF 명세서 v1.2 기준으로 명확화"   // 변경 사유(커밋 메시지)
}
// res 201
{ "reqId": "req-tf-01", "version": "v1.0.2", "author": "한지훈", "at": "2026-08-04T14:30:00" }
```
- 서버가 `changeType`과 직전 버전으로 다음 버전 번호를 계산.
- 첫 확정은 `v1.0.0`.

### `GET /api/requirements/{reqId}/versions` — 버전 이력
```json
// res 200
[
  { "version": "v1.0.1", "changeType": "PATCH", "message": "‘약속된 형식’을 …명확화", "author": "한지훈", "at": "2026-08-04T14:30:00" },
  { "version": "v1.0.0", "changeType": "MINOR", "message": "…해석 확정", "author": "한지훈", "at": "2026-08-02T10:15:00" }
]
```

### `GET /api/requirements/{reqId}/compare?base=v1.0.0&head=v1.0.1` — 버전 비교(diff)
```json
// res 200
{
  "base": "v1.0.0", "head": "v1.0.1", "stat": { "added": 1, "removed": 1 },
  "lines": [
    { "op": "ctx", "no": 1, "text": "우선순위 순 할당, 동일 우선순위는 요청 순." },
    { "op": "del", "no": 2, "text": "newAMOS로부터 약속된 형식의 메시지를 수신…" },
    { "op": "add", "no": 2, "text": "newAMOS로부터 IF 명세서 v1.2 형식의 메시지를 수신…" },
    { "op": "ctx", "no": 3, "text": "AMR 매칭 시 가용 AMR 중 가장 가까운 것 선택." }
  ]
}
```

---

## 6. 산출물 도출 (기능 2 · 준비중)

### `POST /api/requirements/{reqId}/artifacts/derive` — 도출 (요구사항 → 개발 이슈 N개, 각 4종)
요구사항 1개에서 개발 이슈(티켓) N개를 만들고, 개발 이슈마다 4종 산출물을 1:1로 생성한다.
```json
// res 200
{
  "reqId": "req-ta-01",
  "issues": [                                  // 개발 이슈 N개
    {
      "id": "AMVCS30-77", "title": "AMR 매칭", "status": "개발중",
      "body": {                                // 개발 이슈 본문(3 카테고리)
        "현상기록": "…", "개선요청사항": "…", "변경범위": "…", "제약사항": "…", "변경전": "…", "변경후": "…"
      },
      "artifacts": {                           // 개발 이슈 1개당 4종(각 1개)
        "swvoc":     { "id": "AMSWV-2163", "fields": { "요청자": "…", "요청사항": "…", "특이사항": "…" } },
        "functional":{ "id": "AMVCS30-80", "fields": { "개요": "…", "동작정의": [ /* 9행 */ ], "제약사항": "…" } },
        "nonfunctional": { "id": "AMVCS30-82", "fields": { "개요": "…", "동작정의": [ /* 9행 */ ], "제약사항": "…" } },
        "detailDesign":  { "id": "AMVCS30-81", "fields": { "설명": "…", "classDiagram": "…", "sequence": { "asIs": "…", "toBe": "…" } } }
      }
    }
    // … 개발 이슈 #2 … #N
  ]
}
```
- 각 필드에는 작성 주체(`ai`/`human`) 메타가 함께 온다(판단 기준). 예: `현상기록=human`, `개선요청사항=ai`.

### `GET /api/requirements/{reqId}/issues` · `PUT /api/artifacts/{artifactId}` · `POST /api/artifacts/{artifactId}/confirm`
- 개발 이슈·하위 산출물 조회 · 편집 · 확정. (상세 스키마는 기능 2 착수 시 확정)

---

## 7. 추적성 (기능 3 · 준비중)

### `GET /api/requirements/{reqId}/links` — 연결 산출물 조회
```json
// res 200
{ "reqId": "req-ta-01", "tickets": [ { "id": "AMVCS30-77", "title": "AMR 매칭", "status": "개발중",
  "children": [ { "type": "SWVOC", "id": "AMSWV-2163" }, { "type": "FunctionRequirement", "id": "AMVCS30-80" }, { "type": "DetailDesign", "id": "AMVCS30-81" } ] } ] }
```

### `GET /api/requirements/{reqId}/impact` — 변경 영향 분석
```json
// res 200
{ "affected": [ "AMVCS30-77", "AMVCS30-80", "AMVCS30-81" ], "unaffected": [ "AMSWV-2163", "AMVCS30-78" ] }
```

---

## 8. AI 서버 (내부 · FastAPI)

백엔드만 호출한다. 무상태.

### `POST /ai/analyze` — 검출·제안 추론
```json
// req
{ "content": "…", "remark": "…", "engine": "local" }
// res 200
{ "mode": "ollama", "ambiguous": true, "findings": [ … ], "conflicts": [ … ] }
```
- `engine=local` → 로컬 Qwen3-8B(Ollama) · `engine=playground` → 사내 GPT-OSS-120B(OpenAI 호환).
- 도달 불가 시 백엔드가 규칙 mock으로 폴백(`mode: "mock"`).

### `POST /ai/derive` — 산출물 초안 생성 (기능 2)
```json
// req
{ "reqId": "req-ta-01", "content": "…", "templates": ["개발이슈","DetailDesign","SWVOC","기능요구사항","비기능요구사항"] }
// res 200
{ "artifacts": [ … ] }
```

---

## 9. 엔드포인트 요약

| 구간 | 메서드 | 경로 | 기능 |
|---|---|---|---|
| 인증 | POST | /api/auth/signup | 회원가입 |
| 인증 | POST | /api/auth/login | 로그인 |
| 인증 | GET | /api/auth/me | 현재 사용자 |
| 대시보드 | GET | /api/projects/{id}/dashboard | 요약 |
| 대시보드 | GET | /api/projects/{id}/activity | 활동 피드 |
| 요구사항 | GET | /api/projects/{id}/requirements | 목록 |
| 요구사항 | POST | /api/projects/{id}/requirements | 등록 |
| 요구사항 | GET | /api/requirements/{reqId} | 상세 |
| 검토 | POST | /api/requirements/{reqId}/analyze | AI 검토 |
| 검토 | POST | /api/requirements/{reqId}/findings/{fid}/skip | 넘어가기 |
| 버전 | POST | /api/requirements/{reqId}/versions | 확정→새 버전 |
| 버전 | GET | /api/requirements/{reqId}/versions | 이력 |
| 버전 | GET | /api/requirements/{reqId}/compare | 비교(diff) |
| 산출물 | POST | /api/requirements/{reqId}/artifacts/derive | 도출(기능2) |
| 추적성 | GET | /api/requirements/{reqId}/links | 연결(기능3) |
| 추적성 | GET | /api/requirements/{reqId}/impact | 영향분석(기능3) |
| AI | POST | /ai/analyze · /ai/derive | 내부 추론 |
