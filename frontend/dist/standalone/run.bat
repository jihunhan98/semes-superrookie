@echo off
cd /d "%~dp0"
if "%PORT%"=="" set PORT=3000
type build-info.json
node server.js
pause
