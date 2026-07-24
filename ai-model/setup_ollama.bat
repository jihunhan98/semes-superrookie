@echo off
REM ---------------------------------------------------------------------------
REM Windows용 - Ollama 설치 확인 + Qwen3-8B 다운로드
REM 워크스테이션에서 이 파일을 더블클릭하거나, 명령 프롬프트에서 실행.
REM 네트워크가 "반입 O / 반출 X" 라 다운로드(인바운드)는 그대로 동작.
REM ---------------------------------------------------------------------------
setlocal

where ollama >nul 2>nul
if %errorlevel%==0 goto pull

echo Ollama가 설치되어 있지 않습니다.
echo.
echo [설치 방법 - 아래 중 하나]
echo   1. https://ollama.com/download 에서 OllamaSetup.exe 받아 실행 ^(제일 쉬움^)
echo   2. winget install --id Ollama.Ollama -e
echo.
echo 설치가 끝나면 "명령 프롬프트"를 새로 열고 이 파일을 다시 실행하세요.
pause
exit /b 1

:pull
echo [1/1] 모델 다운로드: qwen3:8b
ollama pull qwen3:8b
echo.
echo 완료. 테스트:  ollama run qwen3:8b "안녕"
echo GPU 가속은 NVIDIA 드라이버가 있으면 자동 사용됩니다 ^(P4000^).
pause
