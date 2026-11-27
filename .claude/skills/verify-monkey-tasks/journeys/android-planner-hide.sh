#!/usr/bin/env bash
# Native check on the emulator: a tap on the planner's split handle
# hides the task half in Day, Week and Month, and a second tap shows it.
# It keeps a frame grid of each hide, proves the choice survives an app
# restart, and drags the day split with the half shown. It leaves the
# half shown. Needs an instance from android-launch.sh.
#
#   journeys/android-planner-hide.sh
#
# Evidence lands in a new run folder: a shot of each mode shown and
# hidden, and a frame grid of each hide and show (<name>-frames/sheet.png).
set -euo pipefail
drive="$(dirname "$0")/../scripts/android-drive.sh"
toggle="~task source:"

run=$("$drive" new-run)
"$drive" tap Planner >/dev/null
"$drive" wait "~resize timeline" 20 >/dev/null
# The choice persists, so a run may start on a hidden half. Show it first.
if ! "$drive" has "$toggle"; then
  "$drive" tap "~resize timeline" >/dev/null
fi
"$drive" wait "$toggle" 20 >/dev/null

for mode in Day Week Month; do
  "$drive" tap "$mode" >/dev/null
  case "$mode" in
    Day) handle="~resize timeline" ;;
    *) handle="hide tasks" ;;
  esac
  "$drive" wait "$handle" 20 >/dev/null
  "$drive" wait "$toggle" 20 >/dev/null
  "$drive" shot "$mode-shown" >/dev/null
  "$drive" frames "$mode-hide" 1.5 tap "$handle" >/dev/null
  "$drive" gone "$toggle" 10
  "$drive" shot "$mode-hidden" >/dev/null
  case "$mode" in
    Day) handle="~resize timeline" ;;
    *) handle="show tasks" ;;
  esac
  "$drive" frames "$mode-show" 1.5 tap "$handle" >/dev/null
  "$drive" wait "$toggle" 10 >/dev/null
  "$drive" shot "$mode-reshown" >/dev/null
done

"$drive" tap Day >/dev/null
"$drive" wait "~resize timeline" 20 >/dev/null
read -r x y _ < <("$drive" bounds "~resize timeline")
"$drive" shot day-before-drag >/dev/null
"$drive" swipe "~resize timeline" 0 150 400 >/dev/null
sleep 1
read -r _ y2 _ < <("$drive" bounds "~resize timeline")
"$drive" shot day-after-drag >/dev/null
if [ "$y2" -le "$((y + 60))" ]; then
  echo "the day split did not follow the drag: $y to $y2" >&2
  exit 1
fi

"$drive" tap "~resize timeline" >/dev/null
"$drive" gone "$toggle" 10
"$drive" restart >/dev/null
"$drive" tap Planner >/dev/null
"$drive" wait "~resize timeline" 20 >/dev/null
"$drive" gone "$toggle" 10
"$drive" shot restart-still-hidden >/dev/null
"$drive" tap "~resize timeline" >/dev/null
"$drive" wait "$toggle" 10 >/dev/null
"$drive" log >/dev/null
echo "pass: hid and showed the task half in Day, Week and Month, kept the choice over a restart"
echo "evidence: $run"
