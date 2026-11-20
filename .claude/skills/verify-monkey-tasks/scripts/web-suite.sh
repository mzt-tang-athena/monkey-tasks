#!/usr/bin/env bash
# Full web suite for one checkout, under one heavy slot.
# Usage: web-suite.sh <checkout> <tag> <port> [--background]
. "$(dirname "$0")/heavy.sh" web-suite "$@" || exit 1
logs=${MONKEY_LOG_DIR:-/tmp/monkey-tasks}
mkdir -p "$logs"
cd "$1/app" || exit 1
npm run web:export > "$logs/e2e-export-$2.log" 2>&1 || { echo "export failed"; exit 1; }
flock /tmp/monkey-tasks-e2e.lock env E2E_PORT=$3 npm run e2e -- --workers=2 > "$logs/e2e-$2.log" 2>&1
rc=$?
tail -8 "$logs/e2e-$2.log"
exit $rc
