@echo off
cd /d "%~dp0"
if "%PORT%"=="" set PORT=41000
start "reqops-frontend-server" /min cmd /c "node server.js"
timeout /t 2 /nobreak >nul
start http://localhost:%PORT%/login
