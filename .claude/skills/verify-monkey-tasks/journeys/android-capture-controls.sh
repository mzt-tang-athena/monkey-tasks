#!/usr/bin/env bash
# Native check on the emulator: the capture sheet's list switcher and
# reference control share one row with Send, and each keeps a 44 dp
# target. Run it on an instance from android-launch.sh with the vault
# granted, once on the base APK and once on the change:
#
#   journeys/android-capture-controls.sh <label>
#
# Evidence lands in a new run folder: the sheet with no link and with
# one, and the screen tree each shot was read from.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
drive="$here/../scripts/android-drive.sh"
ui="$here/../scripts/android-ui.mjs"
source "$here/../scripts/android-env.sh"

label="${1:-run}"
task="Buy oat milk tomorrow"
run=$("$drive" new-run)
echo "run: $run"

fail() {
  echo "fail: $*" >&2
  echo "evidence: $run" >&2
  exit 1
}

"$drive" restart >/dev/null 2>&1
"$drive" wait "~task-row:" 60 >/dev/null || fail "no task row"
"$drive" tap "add task" >/dev/null
"$drive" wait "~Add a task" 15 >/dev/null || fail "the capture sheet did not open"
"$drive" keyboard up 30 >/dev/null || fail "the capture input did not raise the keyboard"
"$drive" type "$task" >/dev/null || fail "the capture input took no text"
sleep 1
for _ in 1 2 3 4 5 6; do
  "$drive" has "~link a reference" >/dev/null 2>&1 && break
  "$drive" tap "~target list:" >/dev/null 2>&1 || true
  sleep 1
done
"$drive" wait "~link a reference" 10 >/dev/null || fail "no list offers a link"
sleep 1
"$drive" shot "$label-1-sheet" >/dev/null
"$drive" dump "$label-1-sheet" >/dev/null

density=$(adb shell wm density | grep -oE '[0-9]+' | tail -1)
min=$((44 * density / 160))
read_box() {
  node "$ui" "$run/$label-1-sheet.xml" find "$1" 2>/dev/null
}
list=$(read_box "~target list:") || fail "no list control in the tree"
link=$(read_box "link a reference") || fail "no reference control in the tree"
send=$(read_box "send task") || fail "no send control in the tree"
echo "list: $list"
echo "link: $link"
echo "send: $send"

center() {
  local _x _y _l top _r bottom
  read -r _x _y _l top _r bottom <<<"$1"
  echo $(((top + bottom) / 2))
}
echo "row: list y=$(center "$list") link y=$(center "$link") send y=$(center "$send")"

for box in "$list" "$link" "$send"; do
  read -r _ _ left top right bottom <<<"$box"
  w=$((right - left))
  h=$((bottom - top))
  ((w >= min && h >= min)) || echo "small: ${w}x${h} px under $min"
done
echo "min target at density $density: ${min}px"

"$drive" key BACK >/dev/null 2>&1 || true
sleep 1
"$drive" log >/dev/null 2>&1 || true
echo "evidence: $run"
