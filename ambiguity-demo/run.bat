@echo off
chcp 65001 >nul
REM 요구사항 모호성 데모 — React + Spring Boot + FastAPI 3개 전부 실행 (Windows)
REM 전제: JDK 21, Python 설치. (선택) Ollama + qwen3:8b 실행 시 실제 판정.
REM       Node/npm/Maven 불필요 — React 빌드본(web/dist)과 Spring Boot 빌드본(backend/app.jar) 포함.
setlocal
cd /d "%~dp0"

echo [1/3] AI 서버 (FastAPI) 시작 - http://localhost:8001
start "AI 서버 (FastAPI :8001)" cmd /k "cd ai-server && pip install fastapi uvicorn >nul 2>nul && python -m uvicorn app:app --port 8001"

echo [2/3] 백엔드 (Spring Boot) 시작 - http://localhost:8080  (Swagger: /swagger-ui.html)
start "백엔드 (Spring Boot :8080)" cmd /k "java -jar backend\app.jar"

echo [3/3] 프론트 (React) 시작 - http://localhost:3000
start "프론트 (React :3000)" cmd /k "python -m http.server 3000 --directory web\dist"

echo.
echo 서버 3개 기동 중... (Spring Boot 준비에 10~20초)
timeout /t 14 >nul
start "" http://localhost:3000

echo.
echo   프론트  : http://localhost:3000
echo   백엔드  : http://localhost:8080/swagger-ui.html
echo   AI 서버 : http://localhost:8001/docs
echo   (각 창을 닫으면 해당 서버가 종료됩니다)
