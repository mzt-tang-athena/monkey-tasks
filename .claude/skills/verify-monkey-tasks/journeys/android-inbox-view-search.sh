#!/usr/bin/env bash
# Native check on the emulator: the Inbox header. It reads the names
# TalkBack reads off the screen tree, switches to one column and back,
# restarts the app to prove the choice persists, then searches by a body
# word in each view and clears. It ends in two columns, the default, so
# the journey can run again. Needs an instance from android-launch.sh.
#
#   journeys/android-inbox-view-search.sh
#
# Evidence lands in a new run folder: a shot and a screen dump per step.
set -euo pipefail
drive="$(dirname "$0")/../scripts/android-drive.sh"
run=$("$drive" new-run)

fail() { echo "fail: $*" >&2; echo "evidence: $run" >&2; exit 1; }
named() { grep -q "$2" "$run/$1.txt" || fail "$1 has no node named '$2'"; }

"$drive" tap "Inbox Notes" >/dev/null
"$drive" wait "~note-card:" 20 >/dev/null
sleep 1
"$drive" shot inbox-two >/dev/null
"$drive" dump inbox-two >/dev/null
named inbox-two "search notes"
named inbox-two "switch to one column"
named inbox-two "Inbox Notes, 7 notes"

"$drive" tap "switch to one column" >/dev/null
"$drive" wait "switch to two columns" 10 >/dev/null
sleep 1
"$drive" shot inbox-one >/dev/null
"$drive" dump inbox-one >/dev/null
named inbox-one "switch to two columns"

"$drive" restart >/dev/null
"$drive" tap "Inbox Notes" >/dev/null
"$drive" wait "switch to two columns" 20 >/dev/null
sleep 1
"$drive" shot inbox-one-after-restart >/dev/null

"$drive" tap "search notes" >/dev/null
"$drive" type "atlas" >/dev/null
"$drive" wait "Inbox Notes, 1 of 7 notes" 10 >/dev/null
"$drive" keyboard up >/dev/null
"$drive" shot search-one-column >/dev/null
"$drive" dump search-one-column >/dev/null
named search-one-column "clear search"

"$drive" tap "clear search" >/dev/null
"$drive" wait "Inbox Notes, 7 notes" 10 >/dev/null
"$drive" key BACK
sleep 1
"$drive" shot cleared-one-column >/dev/null

"$drive" tap "switch to two columns" >/dev/null
"$drive" wait "switch to one column" 10 >/dev/null
"$drive" tap "search notes" >/dev/null
"$drive" type "flight refund" >/dev/null
"$drive" wait "Inbox Notes, 1 of 7 notes" 10 >/dev/null
"$drive" keyboard up >/dev/null
"$drive" shot search-two-columns >/dev/null
"$drive" tap "clear search" >/dev/null
"$drive" wait "Inbox Notes, 7 notes" 10 >/dev/null
"$drive" key BACK
sleep 1
"$drive" shot cleared-two-columns >/dev/null
"$drive" log >/dev/null
echo "pass: header names, one column, restart, search by body in both views"
echo "evidence: $run"
