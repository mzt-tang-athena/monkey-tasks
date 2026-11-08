#!/usr/bin/env bash
# Native check on the emulator: swipe from Main to Errands with motion
# on and with reduced motion, then tick a task, read its note, and
# untick it, so the journey can run again on the same vault. Needs an
# instance from android-launch.sh. Leaves motion on.
#
#   journeys/android-list-swipe.sh
#
# Evidence lands in a new run folder: per motion setting a before and
# after shot and every frame of the swipe (<name>-frames/sheet.png),
# then the tick shots, a recording of the tick, the note at each step
# and the app log.
set -euo pipefail
drive="$(dirname "$0")/../scripts/android-drive.sh"
task="Plan weekend hike"
completed() { grep -q '^completed:' "$run/note-$1.md"; }

run=$("$drive" new-run)
for motion in on off; do
  "$drive" motion "$motion" >/dev/null
  read -r x y _ < <("$drive" bounds "~TODAY")
  "$drive" shot "swipe-motion-$motion-before" >/dev/null
  "$drive" frames "swipe-motion-$motion" 1 swipe "@$x,$y" -600 0 300 >/dev/null
  "$drive" wait "Nothing on this list yet." 10
  "$drive" shot "swipe-motion-$motion-after" >/dev/null
done
"$drive" motion on >/dev/null

"$drive" note "Tasks/$task.md" before >/dev/null
if completed before; then
  echo "$task is already done. Relaunch for a fresh vault." >&2
  exit 1
fi
read -r x y _ < <("$drive" bounds "task-row:$task>>mark done")
"$drive" shot tick-before >/dev/null
"$drive" record tick 4 tap "@$x,$y" >/dev/null
"$drive" scroll-to "task-row:$task>>mark not done" >/dev/null
"$drive" shot tick-after >/dev/null
"$drive" note "Tasks/$task.md" ticked >/dev/null
completed ticked || { echo "the note did not gain completed:" >&2; exit 1; }

"$drive" tap "task-row:$task>>mark not done" >/dev/null
"$drive" scroll-to "task-row:$task>>mark done" up >/dev/null
"$drive" shot untick-after >/dev/null
"$drive" note "Tasks/$task.md" unticked >/dev/null
if completed unticked; then
  echo "the note kept completed: after the untick" >&2
  exit 1
fi
"$drive" log >/dev/null
if ! cmp -s "$run/note-before.md" "$run/note-unticked.md"; then
  echo "the untick left the note different from before (ticket 0076, a shorter write keeps the old tail):" >&2
  diff "$run/note-before.md" "$run/note-unticked.md" >&2 || true
  echo "evidence: $run" >&2
  exit 1
fi
echo "pass: swiped to Errands with motion on and off, ticked and unticked $task"
echo "evidence: $run"
