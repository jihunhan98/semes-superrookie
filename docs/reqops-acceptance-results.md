# ReqOps Agent UX 검증 결과

검증일: 2026-09-27 · 브랜치: `codex/reqops-agent-ux-complete`

## 구현 결과

- 사용자 화면은 요구사항 등록 → AI 검출 수정·고객 합의 확정 → 이슈·산출물 자동 도출 → 산출물 검토·전체 확정의 4단계만 노출한다.
- 검출 화면은 문제 구절을 원문에 표시하고 최종 본문을 나란히 편집한다. 고객 합의는 확정 버튼에서 여는 다이얼로그에 방법·담당자·합의일·내용·본문 스냅샷·기록자를 저장한다.
- 분할 화면은 AI 기본안을 제공하며 제목 수정, 위 이슈와 합치기, 구절 둘로 나누기, 추가/삭제를 지원한다.
- 검토 화면은 이슈 목록·세로형 이슈 본문·원 요구사항·연결 산출물 3열을 항상 함께 보여준다. 생성 job의 성공/실패/대기 건수를 복구하고 실패 task만 재시도한다.
- 산출물은 schema v2 고정 양식과 BASIC/VARIANT/EXCEPTION 시나리오를 사용한다. Detail Design은 업무 언어 Mermaid 원문과 렌더링을 제공한다.
- 첨부 원본은 Oracle BLOB에 보존하고 TXT/PDF/DOCX는 텍스트를 추출한다. 이미지는 `UNSUPPORTED`로 명시하며 원본을 보존한다.
- 전체 확정은 이슈/산출물 revision ID와 SHA-256 manifest를 고정하고 command receipt로 동일 명령 재전송을 멱등 처리한다.

## 자동 검증

| 명령 | 결과 |
|---|---|
| `cd frontend && npm test` | 6/6 통과 |
| `cd frontend && npm run typecheck` | 통과 |
| `cd frontend && npm run build` | 통과, Next.js 14 production 21 routes |
| `cd backend && ./mvnw -B test` | 16 tests, 실패 0, 조건부 skip 3 |
| `cd backend && ORACLE_TEST_*=... ./mvnw -B -Poracle-it verify` | BUILD SUCCESS, `OracleSchemaIT` 2/2 통과 |
| `cd ai-model && .venv/bin/python -m pytest -q` | 16/16 통과, 의존 라이브러리 deprecation warning 19건 |
| `git diff --check` | 통과 |

백엔드 skip 3건은 테스트 JVM에서 임시 HTTP socket stub을 열 수 없을 때 skip하는 기존 `AiClientContractTest` 분기다. AI 서버의 동일 계약은 FastAPI `TestClient` 16건과 실제 8001 호출로 별도 검증했다.

## 실제 Oracle·API E2E

로컬 `gvenzl/oracle-free:23-slim` 컨테이너의 `FREEPDB1/REQOPS_TEST` 스키마에서 다음을 확인했다.

1. 확장 테이블 존재, 이슈-산출물 FK `NO ACTION`, 한국어 CLOB 왕복 무손실.
2. 프로젝트 21, 요구사항 21 생성 후 TXT 1건을 BLOB 저장하고 `EXTRACTED` 텍스트 재조회.
3. 고객 합의 스냅샷 저장 후 요구사항 `v1.0.0` 확정.
4. 고정 양식 이슈 2건 확정 후 산출물 8건 자동 생성, job `SUCCEEDED 8/8`.
5. 산출물 8건 개별 확정 후 묶음 전체 확정. manifest 길이 1266자.
6. 동일 idempotency key로 전체 확정을 재전송해 응답 동일, 추가 확정 이력 없음.
7. AI batch API에서 업무 언어 Class/AS-IS/TO-BE Mermaid 생성 성공.

## 브라우저 확인

macOS 인앱 브라우저에서 로그인 후 다음 화면을 실제 API 데이터로 확인했다.

- 프로젝트 홈: 실데이터 지표와 4단계 active flow.
- 단계 2: 원문 하이라이트, 필수 질문 수, 최종 본문, Oracle 첨부, 합의 다이얼로그.
- 단계 3: 저장된 이슈 2건, 제목 수정, 합치기/나누기, 일괄 생성 진입.
- 단계 4: 고정 3열 구조 안의 세로형 이슈 양식, 이슈 목록·연결 산출물, `8/8 생성`, 전체 확정 상태.
- 단계 2 확정: 고객 합의 입력이 배경 딤 처리된 중앙 모달로 표시되고 배경 스크롤이 잠기는 것을 확인.
- 기능/비기능/Detail Design: 단일 세로 흐름, 내용 자동 높이 편집, Mermaid 편집/미리보기 영역, 엔진·schema·내부 키 비노출.
- `REQ-TA-02`: `SoC 최소값`과 존재하지 않는 `req-ta-01` 참조를 필수 확인 항목으로 원문 하이라이트하고 임의 수치·정책을 삽입하지 않음.

## 실행·환경 검증

- macOS에서 Oracle(1521), FastAPI(8001), Spring Boot(8080), Next.js(3000)를 동시에 기동하고 HTTP 응답을 확인했다.
- `run-all.sh --with-backend`는 Terminal.app 새 셸에서도 `backend/.env`를 프로세스 내부에서 다시 읽도록 수정했다.
- `run-all.bat --with-backend`도 같은 `.env` 로딩 절차를 유지하지만 실제 Windows 호스트에서는 실행하지 못했다.

## 남은 검증 제한

- 운영 Oracle 19c의 실제 legacy 데이터, Data Pump 복원, source PK별 snapshot/mapping 및 LOB hash 비교 자료가 없어 M01/M05~M08 검증은 미실행이다.
- in-flight 상태에서 backend를 강제 종료한 lease 회수와 다중 worker `SKIP LOCKED` 경합은 자동 동시성 IT가 없다.
- Gemini/사내 모델 live 호출은 외부 전송·비용을 임의 발생시키지 않기 위해 실행하지 않았다. 키는 `ai-model/.env`의 `GEMINI_API_KEY`, provider는 `AI_PROVIDER=gemini`로만 설정한다.
- 사용자에게 산출물 근거 링크 목록을 직접 보여주는 조회 API와 화면은 아직 없다. `ReviewItem`/`UserDecision`과 `evidence_links` 저장은 연결했으며 현재는 DB 추적으로 확인한다.

## 3단계 진입 전 보강 검증

- OPEN BLOCKING 검출은 본문 재검토로 제거하거나 고객 결정 근거를 입력해야 확정할 수 있다. 수용 결정은 `review_items`와 `user_decisions`에 남는다.
- 이슈 근거 구절은 확정 본문에 포함되고 서로 중복되지 않아야 하며, 재분할 전후 스냅샷과 lineage를 보존한다.
- 산출물 생성·확정 시 사용한 확정 요구사항 버전과 구절을 `evidence_links`에 저장한다. 사용자용 근거 링크 조회 화면/API는 후속 범위로 남아 있다.
- REQ-TA-02를 실제 재분석해 필수 항목 5건(최소 SoC, 거리 양 끝점, 후보 없음, 동률, 미존재 참조)을 화면에서 확인했다.
