#!/usr/bin/env bash
# Read-only: is the instance on $VERIFY_PORT ours, current, and usable?
set -uo pipefail
source "$(dirname "$0")/env.sh"
fail=0
say() { printf '%-8s %s\n' "$1" "$2"; if [[ $1 == FAIL ]]; then fail=1; fi; }

if [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  say ok "server pid $(cat "$PIDFILE") alive"
else
  say FAIL "no server of ours on port $PORT (run launch.sh)"
fi

owner=$(ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
[[ -n "$owner" && -f "$PIDFILE" && "$owner" == "$(cat "$PIDFILE")" ]] \
  && say ok "port $PORT owned by our server" \
  || say FAIL "port $PORT owner is '${owner:-nobody}', not our pid"

head_now=$(git -C "$REPO" rev-parse HEAD)
if [[ ! -f "$STAMP" ]]; then
  say FAIL "dist has no build stamp (run launch.sh without SKIP_EXPORT)"
elif [[ "$(head -1 "$STAMP")" != "$head_now" ]]; then
  say WARN "dist built from $(head -1 "$STAMP" | cut -c1-8), HEAD is ${head_now:0:8}. Relaunch to test HEAD."
elif grep -q dirty "$STAMP"; then
  say WARN "dist built from HEAD plus uncommitted app changes"
else
  say ok "dist built from HEAD ${head_now:0:8}"
fi

if (cd "$APP" && PORT="$PORT" node "$SKILL_DIR/scripts/probe.mjs"); then
  say ok "app renders sample rows and exposes globalThis.__vault"
else
  say FAIL "app did not render a usable screen (see output above)"
fi
exit $fail
