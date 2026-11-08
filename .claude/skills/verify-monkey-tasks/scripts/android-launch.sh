#!/usr/bin/env bash
# Boot the verification emulator, install an APK, seed and grant the
# sample vault, and stop when the app shows its first task row.
#
#   android-launch.sh <apk>      install this APK, then everything below
#   android-launch.sh            reuse the APK already on the emulator
#
# Safe to rerun. It creates the AVD when it is missing, reuses a running
# emulator of ours, reinstalls only a changed APK, and always clears the
# app data and reseeds the vault, so each launch starts from the same
# state. Env: ANDROID_VERIFY_PORT (5580), ANDROID_VERIFY_AVD
# (monkey-tasks-verify), ANDROID_VERIFY_MEMORY (2048 MB), MOTION (on).
set -euo pipefail
source "$(dirname "$0")/android-env.sh"
drive="$SKILL_DIR/scripts/android-drive.sh"
apk=${1:-}
t0=$SECONDS
lap() { echo "[$((SECONDS - t0))s] $*"; }

[[ -z "$apk" || -f "$apk" ]] || { echo "no APK at $apk" >&2; exit 1; }
"$SKILL_DIR/scripts/android-doctor.sh" --host || exit 1

if ! avdmanager list avd -c 2>/dev/null | grep -qx "$AVD"; then
  lap "creating AVD $AVD"
  echo no | avdmanager create avd -n "$AVD" -k "$SYSTEM_IMAGE" -d "$DEVICE_PROFILE" >/dev/null
fi

pid=$(state_get pid)
if ours "$pid"; then
  lap "reusing emulator pid $pid on $SERIAL"
else
  if adb devices | grep -q "^$SERIAL"; then
    echo "$SERIAL is taken by an emulator this skill did not start. Pick another ANDROID_VERIFY_PORT." >&2
    exit 1
  fi
  lap "booting $AVD on port $EMU_PORT"
  # -no-window runs the headless qemu, which needs no audio or Qt libs.
  setsid emulator -avd "$AVD" -port "$EMU_PORT" -no-window -no-audio -no-boot-anim -no-snapshot \
    -gpu swiftshader_indirect -memory "${ANDROID_VERIFY_MEMORY:-2048}" -cores 2 \
    >"$LOGFILE" 2>&1 </dev/null &
  pid=$!
  state_set pid "$pid"
fi
run=$(new_run)

adb -s "$SERIAL" wait-for-device
deadline=$((SECONDS + 600))
until booted; do
  ours "$pid" || { echo "the emulator exited. Its log: $LOGFILE" >&2; exit 1; }
  ((SECONDS < deadline)) || { echo "no boot after 600 s. Its log: $LOGFILE" >&2; exit 1; }
  sleep 3
done
lap "booted"

adb root >/dev/null
adb wait-for-device
until booted; do sleep 1; done
adb shell setprop persist.sys.timezone "$DEVICE_TZ"
adb shell svc power stayon true
adb shell settings put system screen_off_timeout 1800000
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard >/dev/null 2>&1 || true
# Software rendering on a busy host makes System UI miss its ANR
# deadline, and the dialog then covers every screen. Hide the dialogs.
# An ANR still logs, and android-drive.sh log keeps those lines.
adb shell settings put global hide_error_dialogs 1
scale=1
[[ "${MOTION:-on}" == off ]] && scale=0
for key in animator_duration_scale transition_animation_scale window_animation_scale; do
  adb shell settings put global "$key" "$scale"
done

if [[ -n "$apk" ]]; then
  sha=$(sha256sum "$apk" | cut -c1-16)
  if [[ "$(state_get apk_sha)" == "$sha" ]] && adb shell pm path "$PKG" >/dev/null 2>&1; then
    lap "APK $sha already installed"
  else
    lap "installing $(basename "$apk")"
    adb install -r -g "$apk" >/dev/null
    state_set apk_sha "$sha"
    state_set apk "$(realpath "$apk")"
    lap "installed"
  fi
fi
adb shell pm path "$PKG" >/dev/null 2>&1 || { echo "$PKG is not installed. Pass an APK." >&2; exit 1; }

# A fresh vault for the device's today, in the device's zone.
adb shell am force-stop "$PKG"
adb shell pm clear "$PKG" >/dev/null
today=$(adb shell date +%F | tr -d '\r')
seed="$STATE/android-$EMU_PORT-seed"
(cd "$APP" && npx --no-install tsx "$SKILL_DIR/scripts/android-seed.ts" "$seed" "$today")
adb shell rm -rf "$VAULT_DIR"
adb shell mkdir -p "$(dirname "$VAULT_DIR")"
adb push "$seed" "$VAULT_DIR" >/dev/null
lap "seeded $VAULT_DIR"

adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
"$drive" tap "connect vault folder" >/dev/null
# The picker opens where it was last. Read which folder it shows, take
# one step toward Documents/obsidian-vault, and wait for the header to
# change before the next step, so a tap never lands on the next screen.
on_screen() { node "$UI" "$UIXML" find "$1" >/dev/null; }
tap_at() { local at; at=$(node "$UI" "$UIXML" find "$1") && set -- $at && adb shell input tap "$1" "$2"; }
deadline=$((SECONDS + 120))
"$drive" peek
until on_screen ALLOW; do
  ((SECONDS < deadline)) || { "$drive" dump picker-stuck >/dev/null; echo "the folder picker did not reach Allow. See $run/picker-stuck.txt" >&2; exit 1; }
  header=$(node "$UI" "$UIXML" text "~Files " || true)
  case "$header" in
    "Files in obsidian-vault") tap_at "USE THIS FOLDER" ;;
    "Files in Documents") tap_at obsidian-vault ;;
    "Files on "*) tap_at Documents ;;
    "") tap_at "Show roots" || true ;;
    *) tap_at "~sdk_gphone" ;;
  esac
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    "$drive" peek
    on_screen ALLOW && break
    [[ "$(node "$UI" "$UIXML" text "~Files " || true)" != "$header" ]] && break
  done
  if [[ -z "$header" ]] && on_screen "~sdk_gphone"; then tap_at "~sdk_gphone"; sleep 2; "$drive" peek; fi
done
tap_at ALLOW
lap "granted $VAULT_DIR"

"$drive" wait "~task-row:" 90 >/dev/null
"$drive" shot launch >/dev/null
"$drive" dump launch >/dev/null
lap "ready: a task row shows"
echo "serial: $SERIAL"
echo "evidence: $run"
