#!/bin/bash
cd "$(dirname "$0")"
export PORT="${PORT:-3000}"
echo "reqops-frontend 실행 중... http://localhost:$PORT/login"
node server.js
