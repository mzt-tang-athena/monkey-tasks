#!/usr/bin/env bash
# Native check on the emulator: a tick on Today leaves its task under
# Completed on its own list, and unticking then ticking it again leaves
# one note, and one next note for a repeat. Covers a plain task and a
# repeat. Needs an instance from android-launch.sh. The vault ends as
# it began, so the journey can run again.
#
#   journeys/android-today-tick.sh
#
# Evidence lands in a new run folder: a shot at each step and the note
# names after each tap.
set -euo pipefail
drive="$(dirname "$0")/../scripts/android-drive.sh"
source "$(dirname "$0")/../scripts/android-env.sh"
vault="/sdcard/Documents/obsidian-vault/Tasks"
plain="Return library books"
repeat="Supplements"

notes() { adb shell ls "$vault" | tr -d '\r' | grep -c "^$1" || true; }
expect_notes() {
  local name=$1 want=$2 step=$3 deadline=$((SECONDS + 15)) got
  while :; do
    got=$(notes "$name")
    [ "$got" -eq "$want" ] && return 0
    [ "$SECONDS" -ge "$deadline" ] && break
    sleep 1
  done
  echo "FAIL $step: $name has $got notes, wanted $want" >&2
  exit 1
}
reveal() {
  "$drive" scroll-to "$1" down >/dev/null 2>&1 ||
    "$drive" scroll-to "$1" up >/dev/null
}
open_completed() {
  if ! "$drive" has "task-row:$1"; then
    "$drive" scroll-to "~COMPLETED" down >/dev/null
    "$drive" tap "~COMPLETED" >/dev/null
  fi
  "$drive" scroll-to "task-row:$1" down >/dev/null
}

run=$("$drive" new-run)
"$drive" tap Today >/dev/null
"$drive" wait "task-row:$repeat" 20 >/dev/null

for name in "$plain" "$repeat"; do
  slug=${name// /-}
  want=1
  [ "$name" = "$repeat" ] && want=2
  "$drive" tap Today >/dev/null
  "$drive" wait "task-row:$name" 20 >/dev/null
  "$drive" shot "$slug-1-today" >/dev/null
  "$drive" tap "$name" >/dev/null
  "$drive" gone "task-row:$name" 10
  expect_notes "$name" "$want" "tick on Today"

  "$drive" tap Main >/dev/null
  sleep 2
  "$drive" shot "$slug-2-main" >/dev/null
  if "$drive" has "task-row:$name"; then
    echo "FAIL: $name shows in the open groups on Main after a tick on Today" >&2
    exit 1
  fi
  "$drive" scroll-to "~COMPLETED" down >/dev/null
  open_completed "$name"
  "$drive" shot "$slug-3-completed" >/dev/null

  for again in 1 2; do
    "$drive" tap "$name" >/dev/null
    sleep 2
    expect_notes "$name" 1 "untick $again"
    reveal "task-row:$name"
    "$drive" shot "$slug-4-unticked-$again" >/dev/null
    "$drive" tap "$name" >/dev/null
    sleep 2
    expect_notes "$name" "$want" "tick $again"
    open_completed "$name"
    "$drive" shot "$slug-5-reticked-$again" >/dev/null
  done

  reveal "task-row:$name"
  "$drive" tap "$name" >/dev/null
  sleep 2
  expect_notes "$name" 1 "final untick"
  "$drive" tap Today >/dev/null
  "$drive" wait "task-row:$name" 20 >/dev/null
done
"$drive" log >/dev/null
echo "pass: a tick on Today lands in Completed on Main, and untick with tick leaves one note"
echo "evidence: $run"
