#!/usr/bin/env bash
# Time a cold start of the installed APK, N times, on our emulator.
# Each run force-stops the app, starts a Perfetto trace, runs
# `am start -W`, waits for the first rows and for the trace to end.
# coldstart.mjs reads each trace and the log and prints one table.
#
#   android-coldstart.sh <label> [runs]     default 3 runs
#
# The rows-ready mark needs an APK built with EXPO_PUBLIC_STARTUP_MARKS=1.
# Without it the script still reports am start -W, the trace and the
# main thread, and gives up on the rows after COLDSTART_WAIT seconds (60).
#
# Run it through heavy-emulator.sh so the host is as quiet as the lock
# can make it. Evidence lands in <run folder>/coldstart-<label>/.
# Needs trace_processor_shell: set TRACE_PROCESSOR, or fetch it once
# with `python3 -I get.perfetto.dev/trace_processor --version`.
set -euo pipefail
source "$(dirname "$0")/android-env.sh"

label=${1:?usage: android-coldstart.sh <label> [runs]}
runs=${2:-3}
here=$(cd "$(dirname "$0")" && pwd)
run=$(state_get run)
out=${COLDSTART_OUT:-${run:-$EVIDENCE_ROOT}/coldstart-$label}
mkdir -p "$out"

adb get-state >/dev/null 2>&1 || { echo "no emulator on $SERIAL" >&2; exit 1; }
cfg=$here/coldstart.pbtxt

for i in $(seq 1 "$runs"); do
  d=$out/run-$i
  mkdir -p "$d"
  adb shell am force-stop "$PKG"
  adb shell input keyevent KEYCODE_HOME
  sleep 4
  adb logcat -c
  adb shell rm -f /data/misc/perfetto-traces/cs.pftrace
  adb shell "perfetto -c - --txt -o /data/misc/perfetto-traces/cs.pftrace" \
    <"$cfg" >"$d/perfetto.out" 2>&1 &
  for _ in $(seq 1 50); do
    grep -q "Connected to the Perfetto traced service" "$d/perfetto.out" 2>/dev/null && break
    sleep 0.2
  done
  sleep 1
  tp0=$SECONDS
  cut -d' ' -f1 /proc/loadavg >"$d/host-load.txt"
  adb shell am start -W -n "$PKG/.MainActivity" >"$d/am-start.txt"
  seen=0
  for _ in $(seq 1 240); do
    if adb logcat -d | grep -q "startup-mark rows-ready"; then seen=1; break; fi
    (( SECONDS - tp0 >= ${COLDSTART_WAIT:-60} )) && break
    sleep 0.5
  done
  sleep 5
  adb shell pkill -INT -x perfetto || true
  adb logcat -d -v epoch >"$d/logcat.txt"
  wait || true
  adb pull /data/misc/perfetto-traces/cs.pftrace "$d/trace.pftrace" >/dev/null
  echo "run $i: $(grep -E 'TotalTime' "$d/am-start.txt" | tr -d '\r')  marks=$seen" >&2
done

node "$here/coldstart.mjs" "$out"
