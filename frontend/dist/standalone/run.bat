@echo off
cd /d "%~dp0"
if "%PORT%"=="" set PORT=3000
echo reqops-frontend 실행 중... http://localhost:%PORT%
node server.js
pause
