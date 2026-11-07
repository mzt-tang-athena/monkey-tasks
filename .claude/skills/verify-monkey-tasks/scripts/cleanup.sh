#!/usr/bin/env bash
# Stop the server this skill started on $VERIFY_PORT. Evidence stays.
set -uo pipefail
source "$(dirname "$0")/env.sh"
if [[ -f "$PIDFILE" ]]; then
  pid=$(cat "$PIDFILE")
  if tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null | grep -q "serve.py dist $PORT"; then
    kill "$pid" && echo "stopped pid $pid on port $PORT"
  else
    echo "pid $pid is gone or is no longer our serve.py, so nothing was killed"
  fi
  rm -f "$PIDFILE"
else
  echo "no server of ours on port $PORT"
fi
echo "evidence kept in $EVIDENCE_ROOT"
