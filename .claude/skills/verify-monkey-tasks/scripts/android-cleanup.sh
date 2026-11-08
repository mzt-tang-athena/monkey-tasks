#!/usr/bin/env bash
# Stop the emulator this skill started on $ANDROID_VERIFY_PORT. Evidence
# stays. The AVD stays too, so the next launch skips creating it.
#
#   android-cleanup.sh               stop our emulator
#   android-cleanup.sh --delete-avd  also delete the AVD and its disk
set -uo pipefail
source "$(dirname "$0")/android-env.sh"

pid=$(state_get pid)
if ours "$pid"; then
  adb -s "$SERIAL" emu kill >/dev/null 2>&1
  for _ in $(seq 1 30); do ours "$pid" || break; sleep 1; done
  if ours "$pid"; then
    kill "$pid"
    sleep 2
  fi
  ours "$pid" && echo "pid $pid did not stop" >&2 || echo "stopped emulator pid $pid on port $EMU_PORT"
else
  echo "no emulator of ours on port $EMU_PORT, so nothing was killed"
fi
run=$(state_get run)
rm -f "$ASTATE" "$ASTATE.tmp" "$STATE/android-$EMU_PORT".*.xml
rm -rf "$STATE/android-$EMU_PORT-seed"

if [[ "${1:-}" == --delete-avd ]]; then
  avdmanager delete avd -n "$AVD" >/dev/null 2>&1 && echo "deleted AVD $AVD"
fi
echo "evidence kept in ${run:-$EVIDENCE_ROOT}"
