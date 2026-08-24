@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem ============================================================
rem  ReqOps 실행 — AI 서버 / 프론트를 각각 새 창에 띄운다.
rem  창을 따로 여는 이유: 로그가 한 창에 섞이면 어느 쪽 에러인지
rem  구분이 안 되기 때문. 끄려면 stop-all.bat 을 실행.
rem
rem  이 스크립트는 "있는 것만 띄운다". 환경마다 준비 상태가 달라서
rem  (node_modules 대신 빌드 산출물만 있거나) 하나가 없다고 전부 멈추면
rem  오히려 불편하기 때문. 못 띄운 건 이유와 함께 맨 아래에 모아서 알려준다.
rem
rem  백엔드(Spring Boot)는 여기서 띄우지 않는다 — 따로 IDE/터미널에서 직접
rem  실행한다. 이 배치는 AI 서버와 프론트만 담당한다.
rem
rem  cd /d "%~dp0" 로 이미 저장소 루트에 와 있으므로, start 안에서는
rem  상대경로만 쓴다. cmd /k "..." 안에 따옴표를 또 넣으면 경로에 공백이
rem  있을 때 해석이 깨지기 때문.
rem ============================================================

echo.
echo  ===========================================
echo   ReqOps 실행
echo  ===========================================
echo.

set "SKIPPED="

rem ── 1. AI 서버 (FastAPI · 8001) ──────────────────────────────
rem  venv 의 python.exe 를 직접 부른다 — activate 를 거치지 않아도 되고,
rem  어느 가상환경으로 도는지도 명확해진다.

set "PYEXE="
if exist "ai-model\.venv\Scripts\python.exe" set "PYEXE=.venv\Scripts\python.exe"
if not defined PYEXE if exist "ai-model\venv\Scripts\python.exe" set "PYEXE=venv\Scripts\python.exe"

if defined PYEXE (
  echo  [1/2] AI 서버 실행           http://localhost:8001/docs
  start "ReqOps - AI 서버 (8001)" cmd /k "chcp 65001 >nul && cd /d ai-model && %PYEXE% -m uvicorn main:app --port 8001"
  rem 백엔드가 요구사항 등록 때 AI 서버를 부르므로 이쪽이 먼저 떠 있는 게 낫다.
  timeout /t 3 /nobreak >nul
) else (
  echo  [1/2] AI 서버 건너뜀         가상환경 없음
  set "SKIPPED=1"
  set "MSG_AI=1"
)

echo  ^> 백엔드^(8080^)는 이 배치가 아니라 직접 실행하세요.

rem ── 2. 프론트 (Next.js · 3000) ───────────────────────────────
rem  node_modules 가 있으면 개발 서버(코드 수정 즉시 반영), 없으면
rem  커밋된 빌드 산출물로 띄운다. 산출물은 npm install 없이도 돌아간다.

set "FRONTCMD="
set "FRONTMODE="
if exist "frontend\node_modules" (
  set "FRONTCMD=cd /d frontend && npm run dev"
  set "FRONTMODE=개발 서버"
)
if not defined FRONTCMD if exist "frontend\dist\standalone\server.js" (
  set "FRONTCMD=cd /d frontend\dist\standalone && node server.js"
  set "FRONTMODE=빌드 산출물"
)

if defined FRONTCMD (
  echo  [3/3] 프론트 실행            http://localhost:3000/login  ^(%FRONTMODE%^)
  start "ReqOps - 프론트 (3000)" cmd /k "chcp 65001 >nul && %FRONTCMD%"
) else (
  echo  [3/3] 프론트 건너뜀          node_modules 도 빌드 산출물도 없음
  set "SKIPPED=1"
  set "MSG_FRONT=1"
)

echo.
echo  ===========================================
echo   각 창에서 로그를 확인하세요.
echo.
echo    AI 서버   http://localhost:8001/docs
echo    프론트    http://localhost:3000/login
echo.
echo   백엔드^(8080^)는 직접 실행하세요. 프론트가 API 를 8080 으로 부릅니다.
echo.
echo   종료하려면 stop-all.bat 을 실행하세요.
echo  ===========================================

if defined SKIPPED (
  echo.
  echo  --- 못 띄운 것 ---------------------------
  if defined MSG_AI (
    echo.
    echo  AI 서버 - 가상환경이 없습니다. 한 번만 준비하면 됩니다.
    echo      cd ai-model
    echo      python -m venv .venv
    echo      .venv\Scripts\activate
    echo      pip install -r requirements.txt
    echo    ^(AI 서버가 없어도 요구사항 등록은 됩니다 - 규칙 기반으로만 검토됩니다.^)
  )
  if defined MSG_FRONT (
    echo.
    echo  프론트 - node_modules 도 빌드 산출물도 없습니다.
    echo      cd frontend ^&^& npm install       ^(개발 서버로 띄우려면^)
    echo    또는 frontend\dist\standalone 이 저장소에 있는지 확인하세요.
  )
  echo  ------------------------------------------
)

echo.
rem 프론트가 첫 컴파일을 마칠 시간을 준 뒤 브라우저를 연다.
if defined FRONTCMD (
  timeout /t 8 /nobreak >nul
  start http://localhost:3000/login
)

endlocal
