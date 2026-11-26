# Sourced by the android-* scripts. Names, paths and the state of one
# emulator instance. One instance per console port.
source "$(dirname "${BASH_SOURCE[0]}")/env.sh"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="${JAVA_HOME:-$HOME/Android/jdk}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

AVD="${ANDROID_VERIFY_AVD:-monkey-tasks-verify}"
SYSTEM_IMAGE="system-images;android-35;google_apis;x86_64"
DEVICE_PROFILE="pixel_7"
# pixel_7 is 1080 by 2400 px at 420 dpi. Swipes and scrolls assume it.
SCREEN_W=1080
SCREEN_H=2400
EMU_PORT="${ANDROID_VERIFY_PORT:-5580}"
SERIAL="emulator-$EMU_PORT"
export ANDROID_SERIAL="$SERIAL"
PKG="dev.monkey.monkeytasks"
VAULT_DIR="/sdcard/Documents/obsidian-vault"
DEVICE_TZ="Pacific/Auckland"
UI="$SKILL_DIR/scripts/android-ui.mjs"
# The last screen tree that android-drive.sh read.
UIXML="$STATE/android-$EMU_PORT.ui.xml"

# One line per key: pid, run (the evidence dir), apk, apk_sha, watcher.
ASTATE="$STATE/android-$EMU_PORT.state"
LOGFILE="$STATE/android-$EMU_PORT.emulator.log"
# The idle watcher stops an emulator that nobody has touched for this
# long. Every android script stamps a touch when it sources this file, so
# the stamp says the lane is still at work. A leftover emulator holds
# about 3 GB outside the heavy lock, so it must not outlive its use.
IDLE_STAMP="$STATE/android-$EMU_PORT.used"
IDLE_SECS="${ANDROID_VERIFY_IDLE:-300}"

state_get() { if [[ -f "$ASTATE" ]]; then sed -n "s/^$1=//p" "$ASTATE" | tail -1; fi; }
state_set() {
  touch "$ASTATE"
  grep -v "^$1=" "$ASTATE" >"$ASTATE.tmp" || true
  echo "$1=$2" >>"$ASTATE.tmp"
  mv "$ASTATE.tmp" "$ASTATE"
}

# True when $1 is alive and is the emulator this skill started on our port.
ours() {
  [[ -n "${1:-}" && -r /proc/$1/cmdline ]] && tr '\0' ' ' <"/proc/$1/cmdline" 2>/dev/null \
    | grep -q -- "-avd $AVD -port $EMU_PORT "
}

booted() {
  [[ "$(adb -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == 1 ]]
}

# Stop the emulator this skill started on our port and wait for it to go.
# android-cleanup.sh and the idle watcher both stop it this way.
stop_emulator() {
  local pid
  pid=$(state_get pid)
  ours "$pid" || return 0
  adb -s "$SERIAL" emu kill >/dev/null 2>&1
  for _ in $(seq 1 30); do
    ours "$pid" || return 0
    sleep 1
  done
  kill "$pid" 2>/dev/null
  sleep 2
  ours "$pid" && return 1
  return 0
}

# A script that sources this file is a script at work on the emulator.
# It stamps use only when an emulator of ours is up, so a launch that has
# not booted yet does not start the idle clock.
if [[ -n "$(state_get pid)" ]]; then
  touch "$IDLE_STAMP" 2>/dev/null || true
fi

new_run() {
  local run="$EVIDENCE_ROOT/android-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$run"
  state_set run "$run"
  echo "$run"
}
