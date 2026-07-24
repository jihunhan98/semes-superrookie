@echo off
REM 요구사항 모호성 해결 데모 실행 (Windows)
REM 이 파일 더블클릭 → 의존성 설치 후 웹 서버 기동 → 브라우저에서 http://localhost:8010
setlocal

echo [1/2] 의존성 설치
pip install fastapi "uvicorn[standard]" >nul 2>nul

echo [2/2] 서버 시작: http://localhost:8010
echo   (Ollama에 qwen3:8b가 떠 있으면 실제 LLM 판정, 아니면 mock 판정)
echo   종료하려면 이 창에서 Ctrl+C
start "" http://localhost:8010
python -m uvicorn app:app --port 8010
