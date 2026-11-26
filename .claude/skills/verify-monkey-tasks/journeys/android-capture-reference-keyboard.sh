#!/usr/bin/env bash
# Native check on the emulator: the capture sheet's reference picker
# gives the caret back to the task input, so the keyboard stays up.
# Runs the operator's path twice, once with no link and once with one:
# Add, type, open the picker, Done, then keep typing.
#
# Run it on an instance from android-launch.sh with the vault granted:
#
#   journeys/android-capture-reference-keyboard.sh
#
# Evidence lands in a new run folder: the typed sheet, every frame of
# each Done tap, and a settled shot with the focused field read back.
set -uo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
drive="$here/../scripts/android-drive.sh"
ui="$here/../scripts/android-ui.mjs"
source "$here/../scripts/android-env.sh"

task="Pick up milk"
run=$("$drive" new-run)
# The operator types on a real keyboard, so the soft keyboard shows too.
adb shell settings put secure show_ime_with_hard_keyboard 1 >/dev/null
echo "run: $run"

fail() {
  echo "fail: $*" >&2
  echo "evidence: $run" >&2
  exit 1
}

# The focused field must hold what the operator typed, not a button.
expect_focused() {
  local shot=$1 want=$2 got
  got=$(node "$ui" "$run/$shot.xml" focused 2>/dev/null) || got=""
  [[ $got == "$want" ]] || fail "$shot: focused field reads \"$got\", want \"$want\""
  echo "$shot: the caret holds \"$got\""
}

open_capture() {
  "$drive" restart >/dev/null 2>&1
  "$drive" wait "~task-row:" 60 >/dev/null || fail "no task row"
  "$drive" tap "add task" >/dev/null
  "$drive" wait "~Add a task" 15 >/dev/null || fail "the capture sheet did not open"
  "$drive" keyboard up 30 >/dev/null || fail "the capture input did not raise the keyboard"
  "$drive" type "$task" >/dev/null || fail "the capture input took no text"
  # Today is a list, so the link control shows at once. Another default
  # target steps the pill until it does. A tap can land while the sheet
  # is still settling, so the step retries.
  sleep 1
  for _ in 1 2 3 4 5 6; do
    "$drive" has "~link a reference" >/dev/null 2>&1 && break
    "$drive" tap "~target list:" >/dev/null 2>&1 || true
    sleep 1
  done
  "$drive" wait "~link a reference" 10 >/dev/null || fail "no list offers a link"
}

open_picker() {
  "$drive" tap "link a reference" >/dev/null
  "$drive" wait "Find a reference" 15 >/dev/null || fail "the picker did not open"
  "$drive" keyboard up 30 >/dev/null || fail "the picker did not raise the keyboard"
}

# 1. Done with no link.
open_capture
"$drive" shot "01-typed" >/dev/null
open_picker
"$drive" shot "02-picker" >/dev/null
"$drive" frames "done-no-link" 2 tap "Done" >/dev/null
"$drive" keyboard up 30 >/dev/null || fail "Done with no link dropped the keyboard"
"$drive" dump "after-done" >/dev/null
expect_focused after-done "$task"
"$drive" type " and eggs" >/dev/null || fail "the capture input took no text after Done"
"$drive" shot "03-after-done" >/dev/null
"$drive" dump "after-done-typing" >/dev/null
expect_focused after-done-typing "$task and eggs"

# 2. Link a note, then Done.
open_picker
"$drive" type "egg" >/dev/null
"$drive" wait "~chinese-steamed-eggs" 15 >/dev/null || fail "the search found no note"
"$drive" tap "~chinese-steamed-eggs" >/dev/null
sleep 1
"$drive" frames "done-linked" 2 tap "Done" >/dev/null
"$drive" keyboard up 30 >/dev/null || fail "Done after a link dropped the keyboard"
"$drive" wait "~remove reference chinese-steamed-eggs" 15 >/dev/null || fail "the link did not show"
"$drive" dump "after-link" >/dev/null
expect_focused after-link "$task and eggs"
"$drive" type " now" >/dev/null || fail "the capture input took no text after a link"
"$drive" shot "04-after-link" >/dev/null
"$drive" dump "after-link-typing" >/dev/null
expect_focused after-link-typing "$task and eggs now"

"$drive" key BACK >/dev/null 2>&1 || true
sleep 1
"$drive" log >/dev/null 2>&1 || true

echo "pass: the keyboard stayed up and the caret came back after Done"
echo "evidence: $run"
