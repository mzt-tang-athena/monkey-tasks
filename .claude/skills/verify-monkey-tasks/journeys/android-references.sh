#!/usr/bin/env bash
# Native check on the emulator: a task links a note from References/, the
# tile lists it, the preview sheet reads it and gives back, and the
# remove control takes the section out of the note on the device.
#
# Run it on an instance from android-launch.sh with the vault granted:
#
#   journeys/android-references.sh
#
# Evidence lands in a new run folder: the editor, the picker during and
# after the search, the tile, the preview and the note before and after.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
drive="$here/../scripts/android-drive.sh"
source "$here/../scripts/android-env.sh"

task="Book train tickets home"
note="Tasks/$task.md"
run=$("$drive" new-run)
echo "run: $run"

"$drive" restart >/dev/null 2>&1
"$drive" wait "~task-row:" 60 >/dev/null || { echo "no task row" >&2; exit 1; }
"$drive" tap Main >/dev/null
"$drive" scroll-to "~task-row:$task" >/dev/null
"$drive" tap "~task-row:$task" >/dev/null
"$drive" wait "sheet-handle" 15 >/dev/null || { echo "the editor did not open" >&2; exit 1; }
"$drive" shot "01-editor" >/dev/null
"$drive" note "$note" before >/dev/null

"$drive" tap "link a reference" >/dev/null
"$drive" wait "Find a reference" 15 >/dev/null || { echo "the picker did not open" >&2; exit 1; }
"$drive" shot "02-picker" >/dev/null
"$drive" type "egg" >/dev/null
"$drive" wait "~chinese-steamed-eggs" 15 >/dev/null || { echo "the search found no note" >&2; exit 1; }
"$drive" shot "03-picker-found" >/dev/null
"$drive" tap "~chinese-steamed-eggs" >/dev/null
sleep 1
"$drive" shot "04-picker-attached" >/dev/null
"$drive" tap "Done" >/dev/null
"$drive" wait "~open reference chinese-steamed-eggs" 15 >/dev/null || {
  echo "the tile did not show the link" >&2
  exit 1
}
"$drive" shot "05-tile" >/dev/null
"$drive" note "$note" after-attach >/dev/null

"$drive" tap "open reference chinese-steamed-eggs" >/dev/null
"$drive" wait "done with the reference" 15 >/dev/null || { echo "no preview" >&2; exit 1; }
"$drive" shot "06-preview" >/dev/null
"$drive" tap "done with the reference" >/dev/null
sleep 1

"$drive" tap "remove reference chinese-steamed-eggs" >/dev/null
sleep 1
"$drive" wait "~link a reference" 15 >/dev/null || { echo "the link did not leave" >&2; exit 1; }
"$drive" shot "07-detached" >/dev/null
"$drive" note "$note" after-detach >/dev/null
"$drive" log >/dev/null 2>&1 || true

if grep -q "\[\[chinese-steamed-eggs\]\]" "$run/note-after-attach.md"; then
  echo "attach: the note holds the link"
else
  echo "fail: the note holds no link after the attach" >&2
  exit 1
fi
if grep -q "## Reference" "$run/note-after-detach.md"; then
  echo "fail: the note keeps the section after the detach" >&2
  exit 1
fi
echo "pass: attach, preview and detach on the device"
echo "evidence: $run"
