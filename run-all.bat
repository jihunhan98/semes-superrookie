@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

rem ============================================================
rem  ReqOps 전체 실행 — AI 서버 / 백엔드 / 프론트를 각각 새 창에 띄운다.
rem  창을 따로 여는 이유: 세 서버 로그가 한 창에 섞이면 어느 쪽 에러인지
rem  구분이 안 되기 때문. 끄려면 stop-all.bat 을 실행.
rem
rem  이 스크립트는 "있는 것만 띄운다". 환경마다 준비 상태가 달라서
rem  (mvn 이 없거나, node_modules 대신 빌드 산출물만 있거나) 하나가
rem  없다고 전부 멈추면 오히려 불편하기 때문. 못 띄운 건 이유와 함께
rem  맨 아래에 모아서 알려준다.
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
  echo  [1/3] AI 서버 실행           http://localhost:8001/docs
  start "ReqOps - AI 서버 (8001)" cmd /k "chcp 65001 >nul && cd /d ai-model && %PYEXE% -m uvicorn main:app --port 8001"
  rem 백엔드가 요구사항 등록 때 AI 서버를 부르므로 이쪽이 먼저 떠 있는 게 낫다.
  timeout /t 3 /nobreak >nul
) else (
  echo  [1/3] AI 서버 건너뜀         가상환경 없음
  set "SKIPPED=1"
  set "MSG_AI=1"
)

rem ── 2. 백엔드 (Spring Boot · 8080) ───────────────────────────
rem  mvn 이 PATH 에 없는 환경이 흔해서(IDE 안에 내장된 Maven 만 있는 경우)
rem  mvnw -^> mvn -^> 빌드된 jar 순으로 찾아본다. 셋 다 없으면 IDE 에서
rem  직접 실행하라고 안내만 하고 나머지는 그대로 띄운다.

set "BACKCMD="
if exist "backend\mvnw.cmd" set "BACKCMD=mvnw.cmd spring-boot:run"
if not defined BACKCMD (
  where mvn >nul 2>&1
  if not errorlevel 1 set "BACKCMD=mvn spring-boot:run"
)
rem PATH 에 없더라도 MAVEN_HOME/M2_HOME 이 잡혀 있으면 그걸 쓴다.
rem 전체 경로를 명령에 박으면 cmd /k "..." 안에서 따옴표가 중첩돼 깨지므로,
rem PATH 앞에 붙여서 이름만으로 부를 수 있게 한다(자식 창이 이 PATH 를 물려받는다).
if not defined BACKCMD if defined MAVEN_HOME if exist "%MAVEN_HOME%\bin\mvn.cmd" (
  set "PATH=%MAVEN_HOME%\bin;%PATH%"
  set "BACKCMD=mvn spring-boot:run"
)
if not defined BACKCMD if defined M2_HOME if exist "%M2_HOME%\bin\mvn.cmd" (
  set "PATH=%M2_HOME%\bin;%PATH%"
  set "BACKCMD=mvn spring-boot:run"
)
rem 이미 패키징해 둔 jar 이 있으면 Maven 없이도 띄울 수 있다.
if not defined BACKCMD (
  for %%j in (backend\target\*.jar) do if not defined BACKCMD set "BACKCMD=java -jar target\%%~nxj"
)

if defined BACKCMD (
  echo  [2/3] 백엔드 실행            http://localhost:8080
  start "ReqOps - 백엔드 (8080)" cmd /k "chcp 65001 >nul && cd /d backend && %BACKCMD%"
  rem 백엔드는 Oracle 연결까지 있어서 기동이 오래 걸린다. 로그를 흐름대로
  rem 보려고 프론트 띄우기 전에 잠깐 기다린다.
  timeout /t 5 /nobreak >nul
) else (
  echo  [2/3] 백엔드 건너뜀          mvn/mvnw/jar 없음 — IDE 에서 실행하세요
  set "SKIPPED=1"
  set "MSG_BACK=1"
)

rem ── 3. 프론트 (Next.js · 3000) ───────────────────────────────
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
echo    백엔드    http://localhost:8080
echo    프론트    http://localhost:3000/login
echo.
echo   백엔드는 기동에 20~40초 걸립니다.
echo   "Started ReqopsApplication" 로그가 뜨면 준비 완료입니다.
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
  if defined MSG_BACK (
    echo.
    echo  백엔드 - mvn 을 못 찾았습니다. IDE 에서 ReqopsApplication 을 실행하거나,
    echo    아래 중 하나를 준비하면 다음부터 이 배치가 자동으로 띄웁니다.
    echo      1^) Maven 을 설치하고 PATH 에 추가
    echo      2^) backend 폴더에서 한 번 패키징: mvn clean package  ^(target\*.jar 생성^)
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
