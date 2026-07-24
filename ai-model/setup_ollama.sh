#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Ollama 설치 + Qwen3-8B 다운로드 (워크스테이션에서 한 번만 실행)
#
# 네트워크가 "반입 O / 반출 X" 라 설치·다운로드(인바운드)는 그대로 동작한다.
#
# [전제]
#  - Linux (설치 중 sudo 암호를 물을 수 있음). Windows는 아래 README 참고.
#  - GPU 가속하려면 NVIDIA 드라이버가 있어야 함(`nvidia-smi` 동작).
#    없으면 자동으로 CPU로 동작 → 되긴 하지만 느림. P4000 쓰려면 드라이버 설치 필요.
# ---------------------------------------------------------------------------
set -euo pipefail

MODEL="qwen3:8b"

# 1) Ollama 설치 (이미 있으면 건너뜀)
if command -v ollama >/dev/null 2>&1; then
  echo "[1/4] Ollama 이미 설치됨"
else
  echo "[1/4] Ollama 설치 (sudo 암호를 물을 수 있음)"
  curl -fsSL https://ollama.com/install.sh | sh
fi

# 2) GPU 드라이버 확인 (없으면 CPU 폴백 경고)
echo "[2/4] GPU 확인"
if command -v nvidia-smi >/dev/null 2>&1; then
  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || true
else
  echo "  ⚠ nvidia-smi 없음 → GPU 가속 불가(CPU로 동작, 느림). P4000 쓰려면 NVIDIA 드라이버 설치."
fi

# 3) Ollama 서버가 안 떠 있으면 백그라운드로 시작
echo "[3/4] Ollama 서버 확인"
if ! curl -fsS http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "  서버 시작 (백그라운드)"
  (ollama serve >/tmp/ollama.log 2>&1 &)
  sleep 3
fi

# 4) 모델 다운로드
echo "[4/4] 모델 다운로드: ${MODEL}"
ollama pull "${MODEL}"

echo
echo "완료. 테스트:  ollama run ${MODEL} \"안녕\""
echo "AI 서버 연동은 main.py (MODEL_NAME=\"${MODEL}\") 그대로 동작."
