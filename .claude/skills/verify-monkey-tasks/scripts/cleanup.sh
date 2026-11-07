#!/usr/bin/env bash
# Stop the server this skill started on $VERIFY_PORT. Evidence stays.
set -uo pipefail
source "$(dirname "$0")/env.sh"
if [[ -f "$PIDFILE" ]]; then
  pid=$(cat "$PIDFILE")
  kill "$pid" 2>/dev/null && echo "stopped pid $pid on port $PORT" || echo "pid $pid already gone"
  rm -f "$PIDFILE"
else
  echo "no server of ours on port $PORT"
fi
echo "evidence kept in $EVIDENCE_ROOT"
