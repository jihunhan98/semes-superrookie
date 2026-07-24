@echo off
REM 요구사항 모호성 해결 데모 실행 (Windows)
REM 전제: Python 설치. React는 미리 빌드된 web/dist 를 쓰므로 npm/Node 불필요.
setlocal

if exist "web\dist\index.html" (
  echo [1/2] 빌드된 React(web/dist) 사용 - npm/Node 불필요
) else (
  echo [1/2] web/dist 없음 - React 빌드 시도 (이 경우에만 Node/npm 필요)
  cd web
  call npm install
  call npm run build
  cd ..
)

echo [2/2] Python 의존성 + 서버 시작: http://localhost:8010  (종료: Ctrl+C)
pip install fastapi "uvicorn[standard]" >nul 2>nul
start "" http://localhost:8010
python -m uvicorn app:app --port 8010
