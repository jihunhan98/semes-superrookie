@echo off
REM ============================================================
REM  요구사항 모호성 해결 (핵심 기능 1) — 개발 모드 실행 (Windows)
REM  React(Next.js) + Spring Boot + FastAPI 3개 서버를 각각 띄운다.
REM
REM  [사전 준비 — 한 번만] RUN.md 참고
REM   - frontend:  npm install   (Node 필요)
REM   - ai-server: pip install -r requirements.txt   (Python 필요)
REM   - backend:   JDK 21 (Maven은 mvnw 래퍼가 자동 처리)
REM   - (선택) Ollama + qwen3:8b 실행 시 실제 LLM 판정, 없으면 mock
REM ============================================================
setlocal
cd /d "%~dp0"

echo [1/3] AI 서버 (FastAPI) - http://localhost:8001
start "AI 서버 (FastAPI :8001)" cmd /k "cd /d %~dp0ai-server && python -m uvicorn app:app --port 8001"

echo [2/3] 백엔드 (Spring Boot) - http://localhost:8080
start "백엔드 (Spring Boot :8080)" cmd /k "cd /d %~dp0backend && mvnw.cmd spring-boot:run"

echo [3/3] 프론트 (Next.js) - http://localhost:3000
start "프론트 (Next.js :3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo 서버 3개 기동 중... (백엔드 Maven 첫 실행 시 의존성 내려받느라 오래 걸릴 수 있음)
timeout /t 25 >nul
start "" http://localhost:3000

echo.
echo   프론트  : http://localhost:3000
echo   백엔드  : http://localhost:8080/api/analyze
echo   AI 서버 : http://localhost:8001/docs
echo   (각 창을 닫으면 해당 서버가 종료됩니다)
