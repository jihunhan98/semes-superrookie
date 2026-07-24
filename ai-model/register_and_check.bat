@echo off
REM ---------------------------------------------------------------------------
REM 다운받은 GGUF를 Ollama에 등록(qwen3:8b) + 모델 점검까지 한 번에 (Windows)
REM
REM 사용법: 받은 .gguf 파일이 있는 폴더에서 이 파일 실행.
REM   register_and_check.bat                         (기본: Qwen3-8B-Q5_K_M.gguf)
REM   register_and_check.bat 다른파일.gguf            (파일명 지정)
REM ---------------------------------------------------------------------------
setlocal
set GGUF=Qwen3-8B-Q5_K_M.gguf
if not "%~1"=="" set GGUF=%~1

if not exist "%GGUF%" (
  echo GGUF 파일을 찾을 수 없습니다: %GGUF%
  echo 이 .bat 을 gguf 파일이 있는 폴더에서 실행하거나, 파일명을 인자로 주세요.
  pause
  exit /b 1
)

echo [1/3] Modelfile 생성
echo FROM ./%GGUF%> Modelfile

echo [2/3] Ollama 등록: qwen3:8b
ollama create qwen3:8b -f Modelfile
if errorlevel 1 (
  echo 등록 실패 - Ollama 설치/실행 여부를 확인하세요.
  pause
  exit /b 1
)

echo [3/3] 모델 점검 실행 (동작/속도/출력)
python check_model.py
if errorlevel 1 python3 check_model.py

pause
