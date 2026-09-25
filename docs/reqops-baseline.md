# ReqOps Agent UX 구현 기준선

기록일: 2026-09-25

## 작업 트리 보존

- 시작 브랜치: `main`; 구현 브랜치: `codex/reqops-agent-ux`
- 시작 시 존재한 미추적 소스(`backend/domain/deliverable`, 신규 프론트 컴포넌트·issues 화면, 실행 스크립트, 계획 문서)는 reset/clean 없이 보존했다.
- `.idea.unused-root-project`, `frontend/dist`의 생성물과 `.DS_Store`는 제품 소스로 간주하지 않는다.

## 시작 시 검증 결과

- 프론트 타입 검사: 실패. `MermaidDiagram` prop 불일치 2건, development-issue API/type export 누락 18건.
- 백엔드 `./mvnw -B test`: 컴파일 실패. 미추적 deliverable 코드가 참조하는 예외 3종 누락.
- AI 테스트: `pytest`가 설치되지 않아 실행 불가. 기존 테스트 파일도 없었다.
- Oracle: 접속 정보·테스트 인스턴스가 제공되지 않아 실 DB 검증은 수행할 수 없다.

## 보존할 기존 기능

로그인/가입, 프로젝트 생성·참여·설정·멤버/토큰, 요구사항 목록·검색·상태·담당자, 고객 합의, 버전 이력/diff, 기존 issue/artifact URL과 저장 데이터는 호환 대상으로 유지한다. 신규 v2 경로는 기존 데이터를 삭제하지 않는 additive migration으로 도입한다.

## 확인된 데이터 위험

- 기존 재분할은 `DEV_ISSUES`를 물리 삭제하고 artifact FK cascade로 문서까지 삭제할 수 있다.
- 기존 AI draft는 근거 없는 정책·수치(5분, 맨해튼 거리, IDLE/SoC)를 자동 치환한다.
- `application.yml`과 `db/init.sql`에 개발용 DB 비밀번호가 추적 파일로 고정돼 있었다.
- 산출물 조회 GET이 AI 생성과 DB 쓰기를 수행한다.

이 기준선 이후의 완료 여부와 실제 검증 결과는 `docs/reqops-acceptance-results.md`에 누적한다.
