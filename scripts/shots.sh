#!/bin/sh
# Screenshots of the web build at phone size (see scripts/shots.js).
#   TARGET=https://your.workbench.server sh scripts/shots.sh
# Needs Docker (zenika/alpine-chrome:with-puppeteer) and a web build in dist/.
set -e
cd "$(dirname "$0")/.."
mkdir -p docs/screenshots
LIVE_PID=
if [ -n "$TARGET" ]; then
  PORT=8090 node scripts/dev-proxy.mjs & LIVE_PID=$!
else
  export SKIP_LIVE=1
fi
MOCK=1 MOCK_HOLD=1 PORT=8091 node scripts/dev-proxy.mjs & MOCK_PID=$!
trap 'kill $MOCK_PID $LIVE_PID 2>/dev/null' EXIT
sleep 1
docker run --rm --network host -e SKIP_LIVE \
  -v "$PWD/scripts/shots.js:/usr/src/app/shots.js:ro" -v "$PWD/docs/screenshots:/out" \
  --entrypoint node zenika/alpine-chrome:with-puppeteer /usr/src/app/shots.js
