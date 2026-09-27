# ReqOps 로컬 실행

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
