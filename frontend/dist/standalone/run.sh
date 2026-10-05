#!/bin/sh
cd "$(dirname "$0")"
export PORT="${PORT:-3000}"
cat build-info.json
exec node server.js
