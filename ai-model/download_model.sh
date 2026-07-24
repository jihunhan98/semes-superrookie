#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# VCS 요구사항 자동화 — AI 모델 다운로드 스크립트
#
# 모델 가중치(GGUF)는 용량이 커서(수 GB) git에 올리지 않는다. 이 스크립트만
# 버전 관리하고, 실제 파일은 아래처럼 받는다.
#
# 네트워크는 반입 O / 반출 X 이므로 다운로드(반입)는 문제없다.
# [사용법]  워크스테이션에서 바로 실행하거나, 다른 PC에서 실행 후 파일을 옮겨도 됨
#           → ./models/ 에 .gguf 파일이 받아짐 (실행 절차는 ai-model/README.md)
# ---------------------------------------------------------------------------
set -euo pipefail

# P4000(VRAM 8GB)에 맞는 최신 8B 모델 · Q5_K_M 양자화(≈5.85GB).
# 더 가볍게/빠르게 가려면 FILE 을 "Qwen3-8B-Q4_K_M.gguf" 로 바꾼다.
REPO="Qwen/Qwen3-8B-GGUF"
FILE="Qwen3-8B-Q5_K_M.gguf"
OUT="./models"

echo "[1/2] huggingface_hub 설치"
pip install -U "huggingface_hub[cli]"

echo "[2/2] 모델 다운로드: ${REPO} / ${FILE}"
huggingface-cli download "${REPO}" "${FILE}" --local-dir "${OUT}"

echo
echo "완료 → ${OUT}/${FILE}"
echo "이 파일을 폐쇄망 워크스테이션으로 반입한 뒤 ai-model/README.md 의 실행 절차를 따르세요."
