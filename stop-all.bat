@echo off
chcp 65001 >nul
setlocal

rem ============================================================
rem  ReqOps 종료 — run-all.bat 로 띄운 AI 서버 / 프론트를 포트로 찾아 끈다.
rem  창을 하나씩 닫아도 되지만, 창을 닫아도 자식 프로세스가 포트를
rem  물고 있는 경우가 있어서(특히 npm run dev) 포트 기준으로 정리한다.
rem
rem  백엔드(8080)는 run-all.bat 이 띄우지 않으므로 여기서도 건드리지
rem  않는다 — 직접 켜둔 백엔드까지 같이 꺼지면 안 되기 때문.
rem ============================================================

echo.
echo  ===========================================
echo   ReqOps 종료
echo  ===========================================
echo.

call :kill_port 8001 "AI 서버"
call :kill_port 3000 "프론트"

echo.
echo  정리 완료.
echo.
pause
exit /b 0

:kill_port
set "PORT=%~1"
set "LABEL=%~2"
set "FOUND="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"LISTENING" ^| findstr /r /c:":%PORT% "') do (
  if not "%%p"=="0" (
    taskkill /f /pid %%p >nul 2>&1
    if not errorlevel 1 (
      echo  [O] %LABEL% (%PORT%) 종료 - PID %%p
      set "FOUND=1"
    )
  )
)
if not defined FOUND echo  [-] %LABEL% (%PORT%) 실행 중이 아님
exit /b 0
