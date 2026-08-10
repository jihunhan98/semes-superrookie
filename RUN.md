# 실행 가이드 — 기능 1 (회원가입 · 로그인)

스택: Next.js(프론트) → Spring Boot(Java 21, API) → Oracle. 세션/토큰 없음.

## 1. DB (Oracle)

`db/init.sql`을 실행한다.

1. DBA(SYSTEM) 계정으로 접속 → 파일 상단 **스키마 생성** 부분 실행 (`reqops` 사용자 생성)
2. `reqops` 계정으로 접속 → **테이블 생성** 부분 실행 (`USERS`)

> 접속 URL(`XEPDB1`)·비밀번호는 환경에 맞게 `db/init.sql`과 `backend/src/main/resources/application.yml`에서 함께 수정.

## 2. 백엔드 (Spring Boot · Maven)

```bash
cd backend
mvn spring-boot:run
```

> 사내 폐쇄망이라 라이브러리 자동 다운로드가 막히면, `~/.m2/settings.xml`에 사내 저장소(미러)를 잡거나 미리 받아둔 `.m2`를 사용한다.

- 포트 `8080`
- 엔드포인트: `POST /api/signup`, `POST /api/login`
- 빠른 확인:
  ```bash
  curl -X POST http://localhost:8080/api/signup \
    -H "Content-Type: application/json" \
    -d '{"empNo":"20213456","name":"한지훈","dept":"VCS 개발파트","password":"secret123"}'
  ```

## 3. 프론트 (Next.js)

```bash
cd frontend
npm install
npm run dev              # http://localhost:3000
```

- `/signup` 회원가입, `/login` 로그인
- 백엔드 주소는 `NEXT_PUBLIC_BACKEND`(기본 `http://localhost:8080`)

## 현재 범위

회원가입·로그인만 구현. 프로젝트 목록/생성/설정 등은 이후 추가.
명세: `docs/기능명세서.md` · `docs/API명세서.md` · `docs/테이블명세서.md` · 화면: `docs/화면정의서.html`
