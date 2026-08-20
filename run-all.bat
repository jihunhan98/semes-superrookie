@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem ============================================================
rem  ReqOps 전체 실행 — AI 서버 / 백엔드 / 프론트를 각각 새 창에 띄운다.
rem  창을 따로 여는 이유: 세 서버 로그가 한 창에 섞이면 어느 쪽 에러인지
rem  구분이 안 되기 때문. 끄려면 각 창을 닫거나 stop-all.bat 을 실행.
rem
rem  cd /d "%~dp0" 로 이미 저장소 루트에 와 있으므로, 아래 start 안에서는
rem  상대경로만 쓴다. cmd /k "..." 안에 따옴표를 또 넣으면 경로에 공백이
rem  있을 때 해석이 깨지기 때문.
rem ============================================================

echo.
echo  ===========================================
echo   ReqOps 실행
echo  ===========================================
echo.

rem ── 사전 점검 ────────────────────────────────────────────────
rem  준비가 안 된 채로 실행하면 새 창이 순식간에 닫혀서 원인을 못 본다.
rem  그래서 여기서 먼저 확인하고, 없으면 안내만 하고 멈춘다.

set "MISSING="
set "PYDIR="

if exist "ai-model\.venv\Scripts\python.exe" set "PYDIR=.venv"
if not defined PYDIR if exist "ai-model\venv\Scripts\python.exe" set "PYDIR=venv"

if not defined PYDIR (
  echo  [X] AI 서버 - 가상환경이 없습니다.
  echo      cd ai-model
  echo      python -m venv .venv
  echo      .venv\Scripts\activate
  echo      pip install -r requirements.txt
  set "MISSING=1"
)

if not exist "frontend\node_modules" (
  echo  [X] 프론트 - node_modules 가 없습니다.
  echo      cd frontend
  echo      npm install
  set "MISSING=1"
)

where mvn >nul 2>&1
if errorlevel 1 (
  echo  [X] 백엔드 - mvn 을 찾을 수 없습니다. Maven 설치 후 PATH 에 추가하세요.
  set "MISSING=1"
)

if defined MISSING (
  echo.
  echo  위 항목을 먼저 준비한 뒤 다시 실행하세요.
  echo.
  pause
  exit /b 1
)

rem ── 1. AI 서버 (FastAPI · 8001) ──────────────────────────────
echo  [1/3] AI 서버 실행 중...      http://localhost:8001/docs
start "ReqOps - AI 서버 (8001)" cmd /k "chcp 65001 >nul && cd /d ai-model && %PYDIR%\Scripts\python.exe -m uvicorn main:app --port 8001"

rem AI 서버가 먼저 떠 있어야 백엔드가 요구사항 등록 때 바로 호출할 수 있다.
timeout /t 3 /nobreak >nul

rem ── 2. 백엔드 (Spring Boot · 8080) ───────────────────────────
echo  [2/3] 백엔드 실행 중...       http://localhost:8080
start "ReqOps - 백엔드 (8080)" cmd /k "chcp 65001 >nul && cd /d backend && mvn spring-boot:run"

rem 백엔드는 Oracle 연결까지 있어서 기동이 오래 걸린다. 로그를 흐름대로
rem 보려고 프론트 띄우기 전에 잠깐 기다린다.
timeout /t 5 /nobreak >nul

rem ── 3. 프론트 (Next.js · 3000) ───────────────────────────────
echo  [3/3] 프론트 실행 중...       http://localhost:3000/login
start "ReqOps - 프론트 (3000)" cmd /k "chcp 65001 >nul && cd /d frontend && npm run dev"

echo.
echo  ===========================================
echo   세 개 창이 열렸습니다. 각 창에서 로그를 확인하세요.
echo.
echo    AI 서버   http://localhost:8001/docs
echo    백엔드    http://localhost:8080
echo    프론트    http://localhost:3000/login
echo.
echo   백엔드는 기동에 20~40초 걸립니다.
echo   "Started ReqopsApplication" 로그가 뜨면 준비 완료입니다.
echo.
echo   종료하려면 stop-all.bat 을 실행하세요.
echo  ===========================================
echo.

rem 프론트가 첫 컴파일을 마칠 시간을 준 뒤 브라우저를 연다.
timeout /t 8 /nobreak >nul
start http://localhost:3000/login

endlocal
