#!/usr/bin/env bash
# Native check on the emulator: change the vault while the app sits
# closed, start it cold, and see all three changes. A cache of the last
# session must never win over a fresh read, so this journey stays as the
# guard. It adds a task, retitles one and deletes one with adb, then
# undoes all three, so it can run again on the same vault. The app
# opens on Today, so it taps Main to see the notes. Needs an instance
# from android-launch.sh.
#
#   journeys/android-cold-start-vault-change.sh
#
# Evidence lands in a new run folder: the first screen after the cold
# start, and the three notes as the device holds them.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
source "$here/../scripts/android-env.sh"
drive="$here/../scripts/android-drive.sh"

edited="Call Mum"
removed="Read the meter"
added="Cold start added"
notes="$VAULT_DIR/Tasks"

run=$("$drive" new-run)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

"$drive" restart >/dev/null
"$drive" tap "Main" >/dev/null
"$drive" scroll-to "task-row:$removed" >/dev/null
adb shell am force-stop "$PKG"
adb shell "cat '$notes/$edited.md'" | tr -d '\r' >"$work/edited.md"
adb shell "cat '$notes/$removed.md'" | tr -d '\r' >"$work/removed.md"
[ -s "$work/edited.md" ] && [ -s "$work/removed.md" ] || { echo "the sample notes are missing. Relaunch for a fresh vault." >&2; exit 1; }

restore() {
  adb shell "rm -f '$notes/$added.md'" >/dev/null 2>&1 || true
  adb push "$work/edited.md" "$notes/$edited.md" >/dev/null 2>&1 || true
  adb push "$work/removed.md" "$notes/$removed.md" >/dev/null 2>&1 || true
}
trap 'restore; rm -rf "$work"' EXIT

printf -- '---\nkind: "[[tasks]]"\ncreated: 2026-11-26T09:00\ntitle: %s changed\n---\n' "$edited" >"$work/retitled.md"
printf -- '---\nkind: "[[tasks]]"\ncreated: 2026-11-26T09:00\n---\n' >"$work/added.md"
adb push "$work/retitled.md" "$notes/$edited.md" >/dev/null
adb push "$work/added.md" "$notes/$added.md" >/dev/null
adb shell "rm '$notes/$removed.md'"

"$drive" restart >/dev/null
"$drive" tap "Main" >/dev/null
"$drive" scroll-to "task-row:$added" >/dev/null
"$drive" scroll-to "task-row:$edited changed" up >/dev/null
"$drive" gone "task-row:$removed" 10 >/dev/null
"$drive" shot cold-start-after-vault-change >/dev/null
"$drive" note "Tasks/$added.md" added >/dev/null

echo "pass: a cold start showed the added, retitled and deleted notes"
echo "evidence: $run"
