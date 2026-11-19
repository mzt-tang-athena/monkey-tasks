#!/usr/bin/env bash
# Native check on the emulator: tap the task editor's title and prove, in
# both navigation modes, that
# - the soft keyboard is drawn and settled, not merely requested, and
# - the insertion handle hangs from the caret after the sheet lifts.
#
# Android places the handle from the text field's frame. A sheet that
# lifts the field with a transform leaves that frame behind, so the
# handle can land where the field used to be. The frames that follow the
# tap catch the handle while it is on screen, and
# scripts/android-handle.mjs reads the handle and the caret out of each.
#
# Android fades the handle out 4000 ms after it shows
# (`DELAY_BEFORE_HANDLE_FADES_OUT` in `android.widget.Editor`). The
# frames run from one second before the tap to two seconds after, so
# they land inside that window. The settled shot that follows reports a
# missing handle as expected, and it never fails the run.
#
# Run it on an instance from android-launch.sh with the vault granted.
# It sets `show_ime_with_hard_keyboard 1`, flips the navigation overlay
# itself and leaves gesture navigation on.
#
#   journeys/android-editor-keyboard.sh [tries]
#
# Evidence lands in a new run folder: every frame of the tap per try, a
# settled shot and dump, and the run's log.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
scripts="$here/../scripts"
drive="$scripts/android-drive.sh"
handle="$scripts/android-handle.mjs"
source "$scripts/android-env.sh"
tries=${1:-5}

nav() {
  local mode=$1 want=$2 i
  if [[ $mode == three ]]; then
    adb shell cmd overlay enable com.android.internal.systemui.navbar.threebutton >/dev/null 2>&1
    adb shell cmd overlay disable com.android.internal.systemui.navbar.gestural >/dev/null 2>&1
  else
    adb shell cmd overlay disable com.android.internal.systemui.navbar.threebutton >/dev/null 2>&1
    adb shell cmd overlay enable com.android.internal.systemui.navbar.gestural >/dev/null 2>&1
  fi
  for ((i = 0; i < 10; i++)); do
    [[ $(adb shell settings get secure navigation_mode 2>/dev/null | tr -d '\r') == "$want" ]] && return 0
    sleep 1
  done
  echo "the $mode navigation overlay did not take" >&2
  return 1
}

run=$("$drive" new-run)
adb shell settings put secure show_ime_with_hard_keyboard 1 >/dev/null
stranded=0
handle_reads=0
caret_reads=0
for mode in three gesture; do
  nav "$mode" "$([[ $mode == three ]] && echo 0 || echo 2)" || exit 1
  for ((i = 1; i <= tries; i++)); do
    "$drive" restart >/dev/null 2>&1
    "$drive" wait "~task-row:" 60 >/dev/null || { echo "no task row" >&2; exit 1; }
    "$drive" scroll-to "~task-row:" up >/dev/null
    "$drive" tap "~task-row:" >/dev/null
    "$drive" wait sheet-handle 15 >/dev/null || { echo "the editor did not open" >&2; exit 1; }
    sleep 2
    read -r x y _ < <("$drive" bounds "Task name" 2>/dev/null) || { echo "no title field" >&2; exit 1; }
    "$drive" frames "editor-$mode-$i" 2 tap "@$x,$y" >/dev/null
    for frame in "$run/editor-$mode-$i-frames"/[0-9]*.png; do
      read out < <(node "$handle" "$frame")
      echo "$mode try $i $(basename "$frame"): $out"
      case $out in
        *stranded*) stranded=$((stranded + 1)) ;;
      esac
      case $out in
        *" ok,"*) handle_reads=$((handle_reads + 1)) ;;
      esac
      case $out in
        *caret*) caret_reads=$((caret_reads + 1)) ;;
      esac
    done
    if ! "$drive" keyboard up 30 >/dev/null; then
      echo "$mode try $i: the keyboard did not settle up" >&2
      stranded=$((stranded + 1))
    fi
    settled="editor-$mode-$i-settled"
    "$drive" shot "$settled" >/dev/null
    "$drive" dump "$settled" >/dev/null
    read after < <(node "$handle" "$run/$settled.png")
    case $after in
      *"no handle"*) echo "$mode try $i settled: $after, past the fade window" ;;
      *) echo "$mode try $i settled: $after" ;;
    esac
    "$drive" key BACK >/dev/null 2>&1
    sleep 1
    "$drive" key BACK >/dev/null 2>&1
    sleep 1.5
  done
done
nav gesture 2 || true
"$drive" log >/dev/null 2>&1 || true

echo "reads: $caret_reads frames showed a caret, $handle_reads of them showed the handle with it"
if ((stranded > 0)); then
  echo "fail: $stranded reads had a stranded handle or no settled keyboard" >&2
  echo "evidence: $run" >&2
  exit 1
fi
echo "pass: the keyboard settled and every handle read sat with the caret"
echo "evidence: $run"
