@echo off
cd /d "%~dp0"
if not exist "node_modules\next\dist\bin\next" (
  echo Installing frontend dependencies...
  call npm install
  if errorlevel 1 (
    echo Frontend dependency installation failed.
    exit /b 1
  )
)
call npm run dev
