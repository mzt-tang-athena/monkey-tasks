#!/usr/bin/env bash
# Build the web preview with the vault test hooks and serve it on $VERIFY_PORT.
set -euo pipefail
source "$(dirname "$0")/env.sh"

if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  echo "already running: pid $(cat "$PIDFILE") on port $PORT. Run cleanup.sh first."
  exit 1
fi
if ss -ltn "sport = :$PORT" | grep -q LISTEN; then
  echo "port $PORT is busy and not ours. Pick another: VERIFY_PORT=<n> $0"
  exit 1
fi

if [[ "${SKIP_EXPORT:-0}" != 1 ]]; then
  (cd "$APP" && npm run --silent web:export >"$STATE/export.log" 2>&1) || {
    echo "web export failed, see $STATE/export.log"; tail -20 "$STATE/export.log"; exit 1; }
  git -C "$REPO" rev-parse HEAD >"$STAMP"
  git -C "$REPO" status --porcelain -- app contracts | grep -q . && echo dirty >>"$STAMP" || true
fi

cd "$APP"
nohup python3 serve.py dist "$PORT" >"$STATE/server-$PORT.log" 2>&1 &
echo $! >"$PIDFILE"

for _ in $(seq 1 50); do
  curl -sf "http://localhost:$PORT/" -o /dev/null && break
  sleep 0.2
done
"$SKILL_DIR/scripts/doctor.sh"
