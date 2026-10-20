#!/bin/sh
# Screenshots of the web build at phone size (see scripts/shots.js).
#   TARGET=https://your.workbench.server sh scripts/shots.sh
# Needs Docker (zenika/alpine-chrome:with-puppeteer) and a web build in dist/.
# SHOTS_DIR (default docs/screenshots) is where the pictures go.
# SHOTS=orchestrator, rooms or accounts takes only those (scripts/shots-<name>.js).
set -e
cd "$(dirname "$0")/.."
SHOTS_DIR="${SHOTS_DIR:-$PWD/docs/screenshots}"
mkdir -p "$SHOTS_DIR"
if [ -n "$SHOTS" ] && [ -f "scripts/shots-$SHOTS.js" ]; then
  MOCK=1 PORT=8091 node scripts/dev-proxy.mjs & MOCK_PID=$!
  trap 'kill $MOCK_PID 2>/dev/null' EXIT
  sleep 1
  docker run --rm --network host \
    -v "$PWD/scripts/shots-$SHOTS.js:/usr/src/app/shots.js:ro" -v "$SHOTS_DIR:/out" \
    --entrypoint node zenika/alpine-chrome:with-puppeteer /usr/src/app/shots.js
  exit 0
fi
# Without TARGET the server and sign-in screens come from a made-up server
# that starts signed out (MOCK_SIGNIN=1).
if [ -n "$TARGET" ]; then
  PORT=8090 node scripts/dev-proxy.mjs & LIVE_PID=$!
else
  MOCK=1 MOCK_SIGNIN=1 PORT=8090 node scripts/dev-proxy.mjs & LIVE_PID=$!
fi
MOCK=1 MOCK_HOLD=1 PORT=8091 node scripts/dev-proxy.mjs & MOCK_PID=$!
trap 'kill $MOCK_PID $LIVE_PID 2>/dev/null' EXIT
sleep 1
docker run --rm --network host -e SKIP_LIVE \
  -v "$PWD/scripts/shots.js:/usr/src/app/shots.js:ro" -v "$SHOTS_DIR:/out" \
  --entrypoint node zenika/alpine-chrome:with-puppeteer /usr/src/app/shots.js
