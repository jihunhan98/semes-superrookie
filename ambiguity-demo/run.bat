@echo off
REM 요구사항 모호성 해결 데모 실행 (Windows)
REM 전제: Python 설치. React는 미리 빌드된 web/dist 를 쓰므로 npm/Node 불필요.
setlocal
cd /d "%~dp0"

if exist "web\dist\index.html" goto run

echo [빌드] web/dist 가 없어 React 빌드를 시도합니다 - 이때만 Node/npm 필요
cd web
call npm install
call npm run build
cd ..

:run
echo [실행] Python 의존성 확인 후 서버 시작 - http://localhost:8010
echo 종료하려면 이 창에서 Ctrl+C
pip install fastapi "uvicorn[standard]" >nul 2>nul
start "" http://localhost:8010
python -m uvicorn app:app --port 8010
echo.
echo 서버가 종료되었거나 시작에 실패했습니다. 위 메시지를 확인하세요.
pause
