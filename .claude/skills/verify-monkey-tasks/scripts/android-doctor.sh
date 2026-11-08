#!/usr/bin/env bash
# Read-only: can this machine run the emulator, and is the instance on
# $ANDROID_VERIFY_PORT ours, booted, and showing the app with a vault?
#
#   android-doctor.sh           host checks, then instance checks
#   android-doctor.sh --host    host checks only (launch.sh runs this)
#
# Exit code 0 means drivable. A FAIL line names the fix.
set -uo pipefail
source "$(dirname "$0")/android-env.sh"
fail=0
say() { printf '%-5s %s\n' "$1" "$2"; if [[ $1 == FAIL ]]; then fail=1; fi; }

for tool in adb emulator avdmanager node; do
  command -v "$tool" >/dev/null || say FAIL "$tool not found. Install the Android SDK in $ANDROID_HOME (platform-tools, emulator, cmdline-tools)."
done
[[ -d "$ANDROID_HOME/${SYSTEM_IMAGE//;//}" ]] \
  && say ok "system image $SYSTEM_IMAGE" \
  || say FAIL "no $SYSTEM_IMAGE. Run: sdkmanager '$SYSTEM_IMAGE'"
if emulator -accel-check 2>/dev/null | grep -q "is installed and usable"; then
  say ok "KVM usable"
else
  say FAIL "no KVM. The user needs the kvm group: sudo usermod -aG kvm \$USER, then log in again."
fi
qemu="$ANDROID_HOME/emulator/qemu/linux-x86_64/qemu-system-x86_64-headless"
missing=$(LD_LIBRARY_PATH="$ANDROID_HOME/emulator/lib64:$ANDROID_HOME/emulator/lib64/qt/lib" ldd "$qemu" 2>/dev/null | awk '/not found/ { print $1 }' | tr '\n' ' ')
[[ -z "$missing" ]] && say ok "headless qemu links" || say FAIL "headless qemu misses: $missing. Install the package that ships them."
avail=$(awk '/MemAvailable/ { print int($2 / 1024) }' /proc/meminfo)
need=$(( ${ANDROID_VERIFY_MEMORY:-2048} + 512 ))
pid=$(state_get pid)
if ours "$pid"; then
  say ok "host has ${avail} MB free beside our emulator"
elif ((avail < need)); then
  say FAIL "host has ${avail} MB free, the emulator needs about ${need} MB. Stop something, or set ANDROID_VERIFY_MEMORY lower."
else
  say ok "host has ${avail} MB free"
fi
[[ "${1:-}" == --host ]] && exit $fail

if ours "$pid"; then
  say ok "emulator pid $pid is ours ($AVD on port $EMU_PORT)"
else
  say FAIL "no emulator of ours on port $EMU_PORT (run android-launch.sh)"
  exit 1
fi
[[ "$(adb -s "$SERIAL" get-state 2>/dev/null)" == device ]] && booted \
  && say ok "$SERIAL booted" || say FAIL "$SERIAL is not booted"
name=$(adb -s "$SERIAL" emu avd name 2>/dev/null | head -1 | tr -d '\r')
[[ "$name" == "$AVD" ]] && say ok "adb $SERIAL is AVD $name" || say FAIL "adb $SERIAL is '$name', not $AVD"

version=$(adb shell dumpsys package "$PKG" 2>/dev/null | sed -n 's/^ *versionName=//p' | head -1 | tr -d '\r')
if [[ -n "$version" ]]; then
  say ok "$PKG $version installed (apk $(basename "$(state_get apk)") $(state_get apk_sha))"
else
  say FAIL "$PKG is not installed (run android-launch.sh <apk>)"
fi
notes=$(adb shell ls "$VAULT_DIR/Tasks" 2>/dev/null | grep -c '\.md' || true)
((notes > 0)) && say ok "vault $VAULT_DIR holds $notes task notes" || say FAIL "no notes in $VAULT_DIR/Tasks"
adb shell dumpsys activity activities 2>/dev/null | grep -q "topResumedActivity.*$PKG" \
  && say ok "app is in front" || say FAIL "app is not in front"
adb shell uiautomator dump /data/local/tmp/verify-doctor.xml >/dev/null 2>&1
adb exec-out cat /data/local/tmp/verify-doctor.xml >"$STATE/android-$EMU_PORT.doctor.xml" 2>/dev/null
node "$UI" "$STATE/android-$EMU_PORT.doctor.xml" find "~task-row:" >/dev/null 2>&1 \
  && say ok "a task row shows" || say FAIL "no task row on screen (vault not granted, or another screen is open)"
scales=$(for key in animator_duration_scale transition_animation_scale window_animation_scale; do
  adb shell settings get global "$key" | tr -d '\r'; done | tr '\n' ' ')
say info "animation scales: $scales(0 means reduced motion)"
say info "evidence: $(state_get run)"
exit $fail
