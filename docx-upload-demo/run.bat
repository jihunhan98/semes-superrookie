@echo off
REM docx 업로드 확인 데모 실행 (Windows) — 업로드·파싱만 확인하는 최소 도구
REM 전제: Python 설치. (별도 프론트 빌드 없음 — 정적 HTML)
setlocal
cd /d "%~dp0"

echo [1/2] Python 의존성 설치
pip install fastapi "uvicorn[standard]" python-docx python-multipart >nul 2>nul

echo [2/2] 서버 시작: http://localhost:8020  (종료: Ctrl+C)
start "" http://localhost:8020
python -m uvicorn app:app --port 8020
echo.
echo 서버가 종료되었거나 시작에 실패했습니다. 위 메시지를 확인하세요.
pause
