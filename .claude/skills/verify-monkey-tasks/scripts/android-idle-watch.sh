#!/usr/bin/env bash
# Stop the emulator on $ANDROID_VERIFY_PORT once nothing has used it for
# ANDROID_VERIFY_IDLE seconds (300 by default). android-launch.sh starts
# it once per emulator. It outlives the launch unit with the emulator it
# watches, so a lane that walks away frees the 3 GB it holds.
#
# Every android script stamps use when it sources android-env.sh, so a
# journey keeps the emulator alive and an idle one goes. A script that
# is still running keeps it too, even after the stamp goes stale.
#
# Run it by hand to watch one: android-idle-watch.sh
set -u
source "$(dirname "$0")/android-env.sh"

note() { printf '%s %s\n' "$(date -Is)" "$*" >>"$LOGFILE"; }

# A script of ours that is still running is a journey in flight. It
# stamped once at start and may then run for minutes, so the stamp alone
# cannot tell an idle emulator from a busy one. A script that hangs
# keeps the emulator, which android-cleanup.sh ends.
script_running() {
  pgrep -f -- "$SKILL_DIR/scripts/android-" 2>/dev/null | grep -qv "^$$\$"
}

pid=$(state_get pid)
note "idle watcher: watching pid ${pid:-none} on port $EMU_PORT, limit ${IDLE_SECS}s"
while ours "$pid"; do
  sleep 15
  now=$(date +%s)
  used=$(stat -c %Y "$IDLE_STAMP" 2>/dev/null || echo "$now")
  age=$((now - used))
  if ((age >= IDLE_SECS)); then
    if script_running; then
      note "idle watcher: a script is running, keeping the emulator"
      continue
    fi
    note "idle watcher: no use for ${age}s, stopping the emulator"
    if stop_emulator; then
      note "idle watcher: emulator stopped"
    else
      note "idle watcher: the emulator did not stop"
    fi
    break
  fi
done
note "idle watcher: done"
rm -f "$IDLE_STAMP"
