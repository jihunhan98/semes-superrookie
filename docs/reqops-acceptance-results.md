# ReqOps Agent UX 검증 결과

검증일: 2026-09-25 · 브랜치: `codex/reqops-agent-ux`

## 구현 결과

- 요구사항 등록은 원문을 먼저 저장하고 영속 `ANALYZE` job을 함께 enqueue한다. AI 서버가 중단돼도 등록 본문과 `unavailable` draft가 남는다.
- 확정은 고객 합의 ID(호환 요청은 최신 미사용 합의)를 확인하고 LF 정규화 후 합의 본문과 최종 본문의 정확한 일치를 강제한다.
- 확정 버전마다 current bundle을 새로 만들며 이전 bundle과 이슈/문서는 물리 삭제하지 않는다. 재분할 이슈는 `RETIRED`로 보존한다.
- 이슈 확정은 이슈별 VOC/FUNCTIONAL/NONFUNCTIONAL/DETAIL_DESIGN placeholder를 생성하고 Oracle-backed AI job/task를 enqueue한다. lease 만료 recovery와 2초/8초 retry, 성공/실패/pending 집계를 제공한다.
- 산출물은 schema v2 고정 필드와 BASIC/VARIANT/EXCEPTION 3종을 검증하고 revision snapshot을 쌓는다. GET은 더 이상 AI 호출이나 insert를 하지 않는다.
- 검토 화면은 이슈 목록/본문 근거/4종 링크를 함께 표시하고 현재 revision manifest 전체 확정을 수행한다. 확정 지식 projection을 자동 저장한다.
- runtime Mock과 중복 deliverable JPA 도메인/AI client를 제거했고, legacy DB 표는 snapshot importer만 읽는다.

## 실행한 검증

| 명령 | 결과 |
|---|---|
| `frontend/node_modules/.bin/tsc --noEmit --incremental false` | 통과 |
| `cd frontend && npm run build` | 통과, Next.js 14 production 21 routes 생성 |
| `cd frontend && npm run test` | 2/2 통과 |
| `cd frontend && npm run test:e2e` | route smoke 1/1 통과. 실제 3-server/Oracle 브라우저 E2E는 아래 제한으로 미실행 |
| `cd backend && ./mvnw -B test` | 13 tests, 실패 0, skip 3. skip은 외부 AI 서버가 필요한 기존 contract case |
| `cd backend && ./mvnw -B -Poracle-it verify` | BUILD SUCCESS. 13 unit tests(실패 0, skip 3)를 재실행했으며 현재 `*IT` Failsafe 테스트 클래스는 없어 Oracle IT 자동화 완료로 간주하지 않음 |
| `cd ai-model && .venv/bin/python -m pytest -q` | 4/4 통과; Python 3.14 deprecation warning 19건 |
| `bash -n run-all.sh stop-all.sh` | 통과 |
| `git diff --check` | 통과 |
| Oracle 26ai Free fresh schema | `FREEPDB1/REQOPS_TEST`에서 baseline `init.sql` 후 `V002`, `V004`, `V001` 사전 점검 통과. AL32UTF8, 28 tables, invalid index 0, 고아/중복 0 |
| macOS 실제 API smoke | FastAPI(rule)+Spring+Oracle+Next.js 기동. 회원→프로젝트→요구사항→고객 합의→버전 `1.0.0` 확정 성공, `/login` HTTP 200 |

## 환경 때문에 수행하지 못한 검증

- 로컬 Oracle 26ai Free 전용 스키마에서 fresh install, 확장 DDL, 사전 점검과 실제 API 쓰기는 검증했다. 다만 기준 대상인 Oracle 19c, 기존 운영 데이터가 있는 upgrade/import, Data Pump 복원과 원본/복원 LOB hash 비교는 검증하지 못했다.
- 현재 호스트가 macOS라 `run-all.bat --with-backend`, `mvnw.cmd`, 실제 Windows cmd의 한글/공백 경로 검증은 수행할 수 없다.
- Spring+FastAPI+Oracle+Next.js의 실제 API smoke는 수행했지만 브라우저 자동 조작 Playwright E2E와 backend restart queue 회수 시나리오는 수행하지 못했다. frontend의 `test:e2e`는 route/구조 smoke이며 실제 브라우저 E2E 통과로 간주하지 않는다.
- 로컬 Gemini 키는 구성돼 있으나 비용 발생과 외부 전송을 임의로 시작하지 않기 위해 live 호출은 수행하지 않았다. `AI_PROVIDER=rule` 실제 기동과 deterministic 계약은 통과했다.
- PDF/DOCX 첨부 추출 UI/서비스는 이번 변경에 포함되지 않았다. migration의 `REQ_ATTACHMENTS` 저장 구조만 준비돼 있다.
- 다중 worker의 Oracle `SKIP LOCKED` 경합 및 command receipt 기반 HTTP 재전송 완전성은 별도 동시성 IT가 없어 제한사항이다.
