#!/usr/bin/env bash
# ============================================================
#  ReqOps 실행 (macOS/Linux) — AI 서버 / 프론트를 각각 새 터미널
#  창(macOS Terminal.app)에 띄운다. run-all.bat 의 macOS/Linux 버전.
#
#  창을 따로 여는 이유: 로그가 한 창에 섞이면 어느 쪽 에러인지
#  구분이 안 되기 때문. 끄려면 stop-all.sh 를 실행.
#
#  이 스크립트는 "있는 것만 띄운다". 환경마다 준비 상태가 달라서
#  하나가 없다고 전부 멈추면 오히려 불편하기 때문. 못 띄운 건 이유와
#  함께 맨 아래에 모아서 알려준다.
#
#  백엔드(Spring Boot)는 여기서 띄우지 않는다 — 따로 IDE/터미널에서
#  직접 실행한다. 이 스크립트는 AI 서버와 프론트만 담당한다.
# ============================================================

set -u
cd "$(dirname "${BASH_SOURCE[0]}")"
ROOT="$(pwd)"
if [ -f "$ROOT/backend/.env" ]; then set -a; . "$ROOT/backend/.env"; set +a; fi
WITH_BACKEND=0
if [ "${1:-}" = "--with-backend" ]; then WITH_BACKEND=1; fi

echo
echo " ==========================================="
echo "  ReqOps 실행"
echo " ==========================================="
echo

SKIPPED=0
MSG_AI=0
MSG_FRONT=0

# macOS Terminal.app 이 있으면 새 탭에 띄우고, 없으면(Linux 등) 백그라운드로
# 돌리고 로그 파일 경로를 안내한다 — 어느 환경이든 "일단 뜨는" 쪽을 우선한다.
HAS_OSASCRIPT=0
command -v osascript >/dev/null 2>&1 && HAS_OSASCRIPT=1

mkdir -p "$ROOT/.run-logs"

# $1=제목  $2=작업 디렉터리(ROOT 기준 상대경로)  $3=실행할 명령  $4=로그 파일명
launch() {
  local title="$1" dir="$2" cmd="$3" logfile="$4"
  if [ "$HAS_OSASCRIPT" = "1" ]; then
    osascript <<OSA
tell application "Terminal"
  activate
  do script "cd \"$ROOT/$dir\" && echo '== $title ==' && $cmd"
end tell
OSA
  else
    ( cd "$ROOT/$dir" && eval "$cmd" ) > "$ROOT/.run-logs/$logfile" 2>&1 &
    echo "  (새 창 없음 — 백그라운드 실행. 로그: .run-logs/$logfile)"
  fi
}

# ── 1. AI 서버 (FastAPI · 8001) ──────────────────────────────
# venv 의 python 을 직접 부른다 — activate 를 거치지 않아도 되고,
# 어느 가상환경으로 도는지도 명확해진다.
PYEXE=""
if [ -x "ai-model/.venv/bin/python" ]; then PYEXE=".venv/bin/python"
elif [ -x "ai-model/venv/bin/python" ]; then PYEXE="venv/bin/python"
fi

if [ -n "$PYEXE" ]; then
  echo "  [1/3] AI 서버 실행           http://localhost:8001/docs"
  launch "ReqOps - AI 서버 (8001)" "ai-model" "$PYEXE -m uvicorn main:app --port 8001" "ai.log"
  # 백엔드가 요구사항 등록 때 AI 서버를 부르므로 이쪽이 먼저 떠 있는 게 낫다.
  sleep 3
else
  echo "  [1/2] AI 서버 건너뜀         가상환경 없음"
  SKIPPED=1; MSG_AI=1
fi

if [ "$WITH_BACKEND" = "1" ]; then
  echo "  [2/3] 백엔드 실행            http://localhost:8080"
  # Terminal.app가 새 로그인 셸을 만들 때 부모 셸 환경을 잃는 경우가 있어
  # 백엔드 프로세스가 시작되는 바로 그 셸에서 gitignore 된 .env를 다시 읽는다.
  launch "ReqOps - 백엔드 (8080)" "backend" "set -a; [ ! -f .env ] || . ./.env; set +a; ./mvnw spring-boot:run" "backend.log"
else
  echo "  [2/3] 백엔드 건너뜀          필요하면 --with-backend 사용"
fi

# ── 2. 프론트 (Next.js · 3000) ───────────────────────────────
# node_modules 가 있으면 개발 서버(코드 수정 즉시 반영), 없으면
# 커밋된 빌드 산출물로 띄운다. 산출물은 npm install 없이도 돌아간다.
FRONTCMD=""
FRONTMODE=""
if [ -d "frontend/node_modules" ]; then
  FRONTCMD="npm run dev"
  FRONTMODE="개발 서버"
elif [ -f "frontend/dist/standalone/server.js" ]; then
  FRONTCMD="cd dist/standalone && node server.js"
  FRONTMODE="빌드 산출물"
fi

if [ -n "$FRONTCMD" ]; then
  echo "  [3/3] 프론트 실행            http://localhost:3000/login  ($FRONTMODE)"
  launch "ReqOps - 프론트 (3000)" "frontend" "$FRONTCMD" "frontend.log"
else
  echo "  [3/3] 프론트 건너뜀          node_modules 도 빌드 산출물도 없음"
  SKIPPED=1; MSG_FRONT=1
fi

echo
echo " ==========================================="
echo "  각 창(또는 .run-logs/*.log)에서 로그를 확인하세요."
echo
echo "   AI 서버   http://localhost:8001/docs"
echo "   프론트    http://localhost:3000/login"
echo
echo "  백엔드    http://localhost:8080  (--with-backend 또는 별도 실행)"
echo
echo "  종료하려면 stop-all.sh 를 실행하세요."
echo " ==========================================="

if [ "$SKIPPED" = "1" ]; then
  echo
  echo " --- 못 띄운 것 ---------------------------"
  if [ "$MSG_AI" = "1" ]; then
    echo
    echo " AI 서버 - 가상환경이 없습니다. 한 번만 준비하면 됩니다."
    echo "     cd ai-model"
    echo "     python3 -m venv .venv"
    echo "     source .venv/bin/activate"
    echo "     pip install -r requirements.txt"
    echo "   (AI 서버가 없어도 요구사항 등록은 됩니다 - 규칙 기반으로만 검토됩니다.)"
  fi
  if [ "$MSG_FRONT" = "1" ]; then
    echo
    echo " 프론트 - node_modules 도 빌드 산출물도 없습니다."
    echo "     cd frontend && npm install       (개발 서버로 띄우려면)"
    echo "   또는 frontend/dist/standalone 이 저장소에 있는지 확인하세요."
  fi
  echo " ------------------------------------------"
fi

echo
# 프론트가 첫 컴파일을 마칠 시간을 준 뒤 브라우저를 연다.
if [ -n "$FRONTCMD" ]; then
  sleep 8
  if command -v open >/dev/null 2>&1; then
    open "http://localhost:3000/login"
  fi
fi
