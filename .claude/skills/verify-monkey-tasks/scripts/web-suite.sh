#!/usr/bin/env bash
# One heavy job at a time on this 15 GB machine: builds, full e2e runs and
# emulator passes all queue on one lock. -o keeps children from holding it.
if [ -z "${MONKEY_HEAVY_LOCK:-}" ]; then exec env MONKEY_HEAVY_LOCK=1 flock -o /tmp/monkey-tasks-heavy.lock "$0" "$@"; fi
# Full web suite for one checkout, under the shared e2e lock.
# Usage: web-suite.sh <checkout> <tag> <port>
logs=${MONKEY_LOG_DIR:-/tmp/monkey-tasks}
mkdir -p "$logs"
cd "$1/app" || exit 1
npm run web:export > "$logs/e2e-export-$2.log" 2>&1 || { echo "export failed"; exit 1; }
flock /tmp/monkey-tasks-e2e.lock env E2E_PORT=$3 npm run e2e -- --workers=2 > "$logs/e2e-$2.log" 2>&1
rc=$?
tail -8 "$logs/e2e-$2.log"
exit $rc
