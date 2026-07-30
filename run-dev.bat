@echo off
chcp 65001 >nul
REM ============================================================
REM  요구사항 모호성 해결 (핵심 기능 1) — 실행 (Windows)
REM  (chcp 65001: cmd 콘솔을 UTF-8로 — 한글 깨짐 방지. 파일은 UTF-8로 저장됨)
REM  React(Next.js) + Spring Boot + FastAPI 3개 서버를 각각 띄운다.
REM
REM  필요한 것: JDK 21, Python  (npm/Maven 불필요 — 빌드본 포함)
REM   - 프론트: frontend/out (Next.js 정적 빌드본) → python http.server
REM   - 백엔드: backend/app.jar (Spring Boot 빌드본)  → java -jar
REM   - AI    : ai-server (FastAPI) → uvicorn (fastapi, uvicorn만 필요)
REM   - (선택) Ollama + qwen3:8b 실행 시 실제 LLM 판정, 없으면 mock
REM ============================================================
setlocal
cd /d "%~dp0"

echo [1/3] AI 서버 (FastAPI) - http://localhost:8001
start "AI 서버 (FastAPI :8001)" cmd /k "chcp 65001>nul && cd /d %~dp0ai-server && pip install fastapi uvicorn >nul 2>nul && python -m uvicorn app:app --port 8001"

echo [2/3] 백엔드 (Spring Boot) - http://localhost:8080
start "백엔드 (Spring Boot :8080)" cmd /k "chcp 65001>nul && java -jar %~dp0backend\app.jar"

echo [3/3] 프론트 (Next.js 빌드본) - http://localhost:3000
start "프론트 (Next.js :3000)" cmd /k "chcp 65001>nul && python -m http.server 3000 --directory %~dp0frontend\out"

echo.
echo 서버 3개 기동 중... (백엔드 준비에 10~20초)
timeout /t 14 >nul
start "" http://localhost:3000

echo.
echo   프론트  : http://localhost:3000
echo   백엔드  : http://localhost:8080/api/analyze
echo   AI 서버 : http://localhost:8001/docs
echo   (각 창을 닫으면 해당 서버가 종료됩니다)
