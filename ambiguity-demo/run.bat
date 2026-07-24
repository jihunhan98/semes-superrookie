@echo off
REM 요구사항 모호성 해결 데모 실행 (Windows) — React 빌드 + FastAPI 서버
REM 전제: Node.js, Python 설치됨. (Ollama에 qwen3:8b 있으면 실제 판정, 없으면 mock)
setlocal

echo [1/3] React 의존성 설치 + 빌드
cd web
call npm install
call npm run build
cd ..

echo [2/3] Python 의존성 설치
pip install fastapi "uvicorn[standard]" >nul 2>nul

echo [3/3] 서버 시작: http://localhost:8010  (종료: Ctrl+C)
start "" http://localhost:8010
python -m uvicorn app:app --port 8010
