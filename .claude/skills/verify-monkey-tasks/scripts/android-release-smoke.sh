#!/usr/bin/env bash
# Release smoke for monkey-tasks on the emulator. Launch, drive and
# cleanup run inside this one script, under one heavy slot and one flock,
# so the lock and the emulator leave together.
# Usage: android-release-smoke.sh <apk> [--background]
. "$(dirname "$0")/heavy.sh" android-release-smoke "$@" || exit 1
set -u
cd "$(dirname "$0")/../../../.." || exit 1
export ANDROID_VERIFY_PORT=${ANDROID_VERIFY_PORT:-5580}
export PATH=$HOME/Android/Sdk/platform-tools:$PATH
SERIAL=emulator-$ANDROID_VERIFY_PORT
S=.claude/skills/verify-monkey-tasks/scripts
D=$S/android-drive.sh
APK=${1:?apk}
VAULT=/sdcard/Documents/obsidian-vault
PKG=dev.monkey.monkeytasks
cleanup() {
  echo "== cleanup"
  adb -s $SERIAL shell settings put secure show_ime_with_hard_keyboard 0 >/dev/null 2>&1
  adb -s $SERIAL shell cmd overlay enable com.android.internal.systemui.navbar.gestural >/dev/null 2>&1
  $S/android-cleanup.sh 2>&1 | tail -1
  adb kill-server >/dev/null 2>&1
}
trap cleanup EXIT
step() { echo "== $*"; }
pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; }
alive() {
  if adb -s $SERIAL shell pidof $PKG >/dev/null 2>&1; then pass "app alive after $1"; else fail "app died after $1"; fi
}
note() { adb -s $SERIAL shell "cat '$VAULT/$1'" 2>/dev/null; }

step "launch"
launch_out=$(FRESH=1 $S/android-launch.sh "$APK" 2>&1) && launch_rc=0 || launch_rc=$?
printf '%s\n' "$launch_out" | tail -2
if [ "$launch_rc" != 0 ]; then
  fail "launch did not reach a task row"
  exit 1
fi
RUN=$($D run)
echo "run=$RUN"
$D wait "~task-row:" 60 >/dev/null && pass "task rows show" || fail "no task rows"
$D shot s01-lists >/dev/null
$D dump s01-lists >/dev/null
grep -q 'desc="Lists"' "$RUN/s01-lists.txt" && grep -q 'desc="Planner"' "$RUN/s01-lists.txt" && grep -q 'desc="Journal"' "$RUN/s01-lists.txt" \
  && pass "bar names Lists, Planner and Journal" || fail "bar tab names"
grep -q 'desc="Inbox Notes"' "$RUN/s01-lists.txt" && pass "bar names Inbox Notes" || echo "INFO: no Inbox Notes tab"

step "tick a task"
$D tap "task-row:Groceries: milk, eggs, oats>>~Groceries" >/dev/null
sleep 2
note "Tasks/Groceries milk, eggs, oats.md" | grep -q "^completed: " && pass "tick wrote completed" || fail "tick did not write completed"
alive "tick"

step "open Completed and delete all completed"
$D scroll-to "~Completed" >/dev/null 2>&1
$D tap "~Completed" >/dev/null && sleep 1
$D scroll-to "task-row:Groceries: milk, eggs, oats" >/dev/null 2>&1 && pass "Completed opens and shows the tick" || fail "Completed did not open"
$D shot s02-completed >/dev/null
before=$(adb -s $SERIAL shell "ls $VAULT/Tasks/ | wc -l" | tr -d '\r')
$D tap "list menu" >/dev/null && sleep 1
$D tap "Delete all completed tasks" >/dev/null && sleep 1
$D shot s03-confirm >/dev/null
$D tap "Delete" >/dev/null && sleep 2
after=$(adb -s $SERIAL shell "ls $VAULT/Tasks/ | wc -l" | tr -d '\r')
echo "task notes: $before before, $after after"
[ "$after" -lt "$before" ] && pass "delete removed done notes" || fail "delete removed nothing"
alive "delete"

step "task sheet opens, drag closes it"
$D scroll-to "task-row:Call Mum" up >/dev/null 2>&1
set -- $($D bounds "task-row:Call Mum") 0 0
$D tap "@600,$2" >/dev/null && sleep 2
$D wait sheet-handle 10 >/dev/null && pass "sheet opens" || fail "sheet did not open"
$D shot s04-sheet >/dev/null
set -- $($D bounds sheet-handle) 0 0
$D swipe "@540,$2" 0 400 250 >/dev/null && sleep 2
alive "sheet drag"
$D has "change list, Main" && fail "sheet still open" || pass "drag closed the sheet"
$D shot s05-sheet-closed >/dev/null

step "journal entry and food entry"
$D tap Journal >/dev/null && sleep 2
day=$(adb -s $SERIAL shell date +%F | tr -d '\r')
$D tap "add entry" >/dev/null && sleep 1
$D type "Release smoke entry" && sleep 1
$D tap "send entry" >/dev/null && sleep 2
note "Journal/Daily/$day.md" | grep -q "^- Release smoke entry" && pass "journal entry written" || fail "journal entry missing"
$D tap "add entry" >/dev/null 2>&1 || { $D tap Journal >/dev/null; sleep 1; $D tap "add entry" >/dev/null; }
sleep 1
$D tap "food entry: off" >/dev/null && sleep 1
$D type "toast" && sleep 1
$D tap "send entry" >/dev/null && sleep 2
note "Journal/Daily/$day.md" | grep -q "^- Ate: toast #food" && pass "food entry written" || fail "food entry missing"
note "Journal/Daily/$day.md" | tail -2 | grep -q '!\[\[daily.base\]\]' && pass "embed stays last" || fail "embed moved"
$D shot s06-journal >/dev/null
alive "journal"

step "inbox notes"
if $D tap "Inbox Notes" >/dev/null 2>&1; then
  sleep 2
  $D dump s07a-inbox >/dev/null
  cards=$(grep -c 'note-card:' "$RUN/s07a-inbox.txt")
  echo "note cards on screen: $cards"
  [ "$cards" -gt 0 ] && pass "inbox lists notes" || fail "inbox shows no notes"
  $D shot s07a-inbox >/dev/null
  n0=$(adb -s $SERIAL shell "ls $VAULT/Inbox/ | wc -l" | tr -d '\r')
  $D tap "add note" >/dev/null && sleep 1
  $D tap "note text" >/dev/null 2>&1; $D type "Release smoke note" && sleep 1
  $D shot s07b-composer >/dev/null
  $D tap "save note" >/dev/null && sleep 2
  n1=$(adb -s $SERIAL shell "ls $VAULT/Inbox/ | wc -l" | tr -d '\r')
  echo "inbox notes: $n0 before, $n1 after"
  adb -s $SERIAL shell "grep -l 'Release smoke note' $VAULT/Inbox/*" 2>/dev/null | grep -q . && pass "captured note lands in Inbox/" || fail "captured note missing"
  $D shot s07c-inbox-after >/dev/null
  alive "inbox"
else
  echo "SKIP: no Inbox Notes tab in this build"
fi

step "planner day split reaches both edges"
$D tap Planner >/dev/null && sleep 2
$D wait "resize timeline" 10 >/dev/null && pass "split grip shows" || fail "no split grip"
set -- $($D bounds "resize timeline") 0 0; y0=$2
$D swipe "resize timeline" 0 -2000 600 >/dev/null && sleep 1
set -- $($D bounds "resize timeline") 0 0; yup=$2
$D swipe "resize timeline" 0 2000 600 >/dev/null && sleep 1
set -- $($D bounds "resize timeline") 0 0; ydown=$2
echo "grip y: start $y0, after up $yup, after down $ydown"
[ "$yup" -lt "$y0" ] && [ "$ydown" -gt "$y0" ] && pass "split travels both ways" || fail "split did not travel"
$D shot s07-planner >/dev/null
alive "split drag"

step "theme switch"
$D tap "open settings" >/dev/null && sleep 2
$D scroll-to "Midnight" >/dev/null 2>&1
$D tap "Midnight" >/dev/null && sleep 1
$D shot s08-midnight >/dev/null
$D tap back >/dev/null && sleep 1
$D shot s09-planner-midnight >/dev/null
alive "theme switch"

step "the bar's gap opens the command pane"
$D tap Lists >/dev/null && sleep 1
$D wait "~task-row:" 60 >/dev/null
$D swipe "bar-gap" 0 350 250 >/dev/null
$D wait command-search 20 >/dev/null && pass "a swipe on the bar's gap opens the pane" || fail "the gap swipe did not open the pane"
$D shot s10-pane >/dev/null
$D dump s10-pane >/dev/null
commands=$(grep -c 'id="command:' "$RUN/s10-pane.txt")
echo "command rows on screen: $commands"
[ "$commands" -gt 0 ] && pass "the pane lists commands" || fail "the pane lists no commands"
$D tap "close commands" >/dev/null 2>&1 || $D key BACK >/dev/null 2>&1
$D gone command-search 10 >/dev/null && pass "the pane closes" || fail "the pane stayed open"
alive "command pane"

step "the task editor clears three-button navigation"
nav_mode() { adb -s $SERIAL shell settings get secure navigation_mode 2>/dev/null | tr -d '\r'; }
set_nav() {
  adb -s $SERIAL shell cmd overlay enable "com.android.internal.systemui.navbar.$1" >/dev/null 2>&1
  adb -s $SERIAL shell cmd overlay disable "com.android.internal.systemui.navbar.$2" >/dev/null 2>&1
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ "$(nav_mode)" = "$3" ] && return 0
    sleep 1
  done
  return 1
}
set_nav threebutton gestural 0 && pass "three-button navigation on" || fail "three-button navigation did not take"
$D restart >/dev/null 2>&1
$D wait "~task-row:" 60 >/dev/null
$D tap "~task-row:" >/dev/null && pass "a row picked from the screen opens the editor" || fail "no row on screen to open"
$D wait sheet-handle 20 >/dev/null && pass "the editor shows" || fail "the editor did not show"
sleep 1
$D shot s11-editor-three-button >/dev/null
$D dump s11-editor-three-button >/dev/null
read -r _ _ _ _ _ sheet_bottom < <($D bounds sheet-dock 2>/dev/null)
read -r _ _ _ nav_top _ _ < <($D bounds navigationBarBackground 2>/dev/null)
echo "editor bottom ${sheet_bottom:-none}, nav bar top ${nav_top:-none}"
if [ -n "$sheet_bottom" ] && [ -n "$nav_top" ] && [ "$sheet_bottom" -lt "$nav_top" ]; then
  pass "the editor clears the nav bar by $((nav_top - sheet_bottom))px"
else
  fail "the editor sits under the nav bar, or a bound is missing"
fi
alive "three-button editor"
$D key BACK >/dev/null
sleep 1
set_nav gestural threebutton 2 && pass "gesture navigation back on" || fail "gesture navigation did not come back"

step "log"
$D log s12-log >/dev/null
n=$(grep -E "FATAL EXCEPTION" -A1 "$RUN/s12-log.log" 2>/dev/null | grep -c "$PKG")
[ "$n" = 0 ] && pass "no app crash in the log" || fail "$n app crashes in the log"

step "the editor keyboard journey"
J=.claude/skills/verify-monkey-tasks/journeys/android-editor-keyboard.sh
keyboard_out=$($J 1 2>&1) && keyboard_rc=0 || keyboard_rc=$?
printf '%s\n' "$keyboard_out" | tail -8
[ "$keyboard_rc" = 0 ] && pass "the keyboard journey passed" || fail "the keyboard journey failed"
keyboard_run=$(printf '%s\n' "$keyboard_out" | sed -n 's/^evidence: //p' | tail -1)

step "done $RUN"
echo "keyboard run=${keyboard_run:-none}"
