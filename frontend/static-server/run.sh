#!/bin/bash
cd "$(dirname "$0")"
export PORT="${PORT:-3000}"

node server.js &
SERVER_PID=$!
sleep 1

URL="http://localhost:$PORT/login"
if command -v open >/dev/null 2>&1; then
  open "$URL"          # macOS
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL"       # Linux
else
  echo "브라우저에서 $URL 을 열어주세요."
fi

wait "$SERVER_PID"
