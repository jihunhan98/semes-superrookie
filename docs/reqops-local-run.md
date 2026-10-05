# ReqOps 로컬 실행

## npm 설치가 불가능한 Windows: 배포본 실행

1. 기존 서버는 `stop-all.bat`로 종료한다.
2. `codex/reqops-agent-ux-complete` 브랜치의 전체 파일을 새 폴더에 받거나 해당 브랜치를 pull한다. 배포본은 일부 JS 파일만 복사하지 말고 `frontend/dist/standalone` 전체를 교체한다.
3. Node.js가 설치된 PC에서 `run-all.bat`를 실행한다. 기본값은 standalone 배포본이며 `npm install`은 필요하지 않다.
4. 실행 창에 `Agent UX 배포본`과 `build-info.json`의 소스 커밋·빌드 시각이 표시되는지 확인한다. 브라우저는 `http://localhost:3000/login`으로 접속한다.
5. 이전 화면이 남으면 기존 3000 포트 서버가 종료됐는지 확인하고 Ctrl+F5로 새로고침한다.

백엔드와 AI 서버도 같은 브랜치 소스를 사용해야 한다. 기존 Oracle 데이터베이스에는 아래 마이그레이션 실행서를 먼저 적용해야 하며, 프런트 배포본만 교체해서 신규 API와 DB 구조까지 갱신되지는 않는다.

개발 서버를 명시적으로 쓰려면 `run-all.bat --dev`, 백엔드도 실행하려면 `run-all.bat --with-backend`를 사용한다. 두 옵션은 함께 사용할 수 있다.

인터넷이 되는 빌드 PC에서 배포본을 다시 만들 때:

```bash
cd frontend
npm ci
npm run build:offline
```

이 명령은 서버·실행 의존성·정적 파일을 함께 묶고 기존 배포 폴더를 교체한다. 소스만 수정한 후에는 배포본에도 반영하도록 다시 실행한다.

2026-10-06: 프로덕션 빌드 및 타입 검사, 기존 프런트 테스트 6건 통과. 개발 폴더와 분리한 standalone에서 로그인·편집·이슈·검토·상세 설계 경로와 해당 JS/CSS의 HTTP 200 응답 확인. Windows 배치 실행 및 사내 Oracle/LLM 연동은 미검증.

비밀값은 Git 추적 파일이 아니라 환경변수 또는 각 디렉터리의 `.env`에만 둔다.

## macOS

```bash
cp backend/.env.example backend/.env
cp ai-model/.env.example ai-model/.env
cp frontend/.env.example frontend/.env.local
cd ai-model && python3.13 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && cd ..
cd frontend && npm ci && cd ..
# backend/.env에 실제 DB_URL, DB_USERNAME, DB_PASSWORD를 입력한 뒤
# Gemini를 사용할 때만 ai-model/.env에 AI_PROVIDER=gemini와 GEMINI_API_KEY를 입력
./run-all.sh --with-backend
```

백엔드를 IDE에서 실행하려면 `./run-all.sh`만 실행하고, `backend`에서 `./mvnw spring-boot:run`을 별도로 실행한다.

## Windows (cmd)

```bat
copy backend\.env.example backend\.env
copy ai-model\.env.example ai-model\.env
copy frontend\.env.example frontend\.env.local
cd ai-model
py -3.13 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
cd ..\frontend
npm ci
cd ..
set DB_URL=jdbc:oracle:thin:@localhost:1521/XEPDB1
set DB_USERNAME=REQOPS
set DB_PASSWORD=실제값
rem Gemini 사용 시 ai-model\.env에 AI_PROVIDER=gemini, GEMINI_API_KEY=실제값 설정
run-all.bat --with-backend
```

포트는 프론트 3000, 백엔드 8080, AI 8001이다. 종료는 macOS에서 `./stop-all.sh`, Windows에서 `stop-all.bat`를 사용한다. Oracle migration은 `docs/reqops-migration-runbook.md` 순서로 별도 적용한다.
