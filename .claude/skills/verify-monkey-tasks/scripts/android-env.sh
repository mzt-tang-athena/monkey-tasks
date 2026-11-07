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
EMU_PORT="${ANDROID_VERIFY_PORT:-5580}"
SERIAL="emulator-$EMU_PORT"
export ANDROID_SERIAL="$SERIAL"
PKG="dev.monkey.monkeytasks"
VAULT_DIR="/sdcard/Documents/obsidian-vault"
DEVICE_TZ="Pacific/Auckland"
UI="$SKILL_DIR/scripts/android-ui.mjs"
# The last screen tree that android-drive.sh read.
UIXML="$STATE/android-$EMU_PORT.ui.xml"

# One line per key: pid, run (the evidence dir), apk, apk_sha.
ASTATE="$STATE/android-$EMU_PORT.state"
LOGFILE="$STATE/android-$EMU_PORT.emulator.log"

state_get() { [[ -f "$ASTATE" ]] && sed -n "s/^$1=//p" "$ASTATE" | tail -1; }
state_set() {
  touch "$ASTATE"
  grep -v "^$1=" "$ASTATE" >"$ASTATE.tmp" || true
  echo "$1=$2" >>"$ASTATE.tmp"
  mv "$ASTATE.tmp" "$ASTATE"
}

# True when $1 is alive and is the emulator this skill started on our port.
ours() {
  [[ -n "${1:-}" ]] && tr '\0' ' ' <"/proc/$1/cmdline" 2>/dev/null \
    | grep -q -- "-avd $AVD -port $EMU_PORT "
}

booted() {
  [[ "$(adb -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == 1 ]]
}

new_run() {
  local run="$EVIDENCE_ROOT/android-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$run"
  state_set run "$run"
  echo "$run"
}
