#!/usr/bin/env bash
# ============================================================
#  ReqOps 전체 종료 (macOS/Linux) — run-all.sh 로 띄운 세 서버를
#  포트로 찾아 끈다. run-all.sh 가 새 터미널 창을 열었으면 창을
#  하나씩 닫아도 되지만, 자식 프로세스가 포트를 물고 있는 경우가
#  있어서(특히 npm run dev) 포트 기준으로 정리한다.
# ============================================================

echo
echo " ==========================================="
echo "  ReqOps 종료"
echo " ==========================================="
echo

kill_port() {
  local port="$1" label="$2"
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null)
  if [ -z "$pids" ]; then
    echo "  [-] $label ($port) 실행 중이 아님"
    return
  fi
  for pid in $pids; do
    if kill -9 "$pid" 2>/dev/null; then
      echo "  [O] $label ($port) 종료 - PID $pid"
    fi
  done
}

kill_port 8001 "AI 서버"
kill_port 8080 "백엔드"
kill_port 3000 "프론트"

echo
echo "  정리 완료."
echo
