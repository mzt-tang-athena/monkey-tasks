#!/usr/bin/env bash
# Native check on the emulator: the buttons on a reminder work with the
# app killed. It writes four tasks that fall due in two minutes, kills
# the app, waits for the reminders, then presses a button on each from
# the notification shade, with the app killed before every press:
#
#   Probe Plain   Done writes completed
#   Probe Daily   Done writes completed and makes the next note
#   Probe Later   the Reschedule button moves the due and the reminder
#   Probe Gone    the note is deleted first, so Done fails and says so
#
# Needs an instance from android-launch.sh. RESCHEDULE_BUTTON names the
# Reschedule button to press. With none set, that task is not written.
#
#   RESCHEDULE_BUTTON=Tomorrow journeys/android-reminder-actions.sh
#
# Evidence lands in a new run folder: the shade with the buttons, the
# notes before and after each press, and the app log.
set -euo pipefail
here="$(dirname "$0")/../scripts"
drive="$here/android-drive.sh"
press="$here/android-press.sh"
source "$here/android-env.sh"

reschedule=${RESCHEDULE_BUTTON:-}
tasks="$VAULT_DIR/Tasks"
run=$("$drive" new-run)

device_date() { adb shell date -d "@$1" +%Y-%m-%dT%H:%M | tr -d '\r'; }
note_text() { adb shell "cat '$tasks/$1.md'" | tr -d '\r'; }
note_exists() { adb shell "test -f '$tasks/$1.md' && echo yes || echo no" | tr -d '\r'; }
in_tray() { adb shell dumpsys notification --noredact | grep -c "${1// /%2520}.md:" || true; }
fail() { echo "FAIL: $*" >&2; echo "evidence: $run" >&2; exit 1; }

kill_app() {
  adb shell input keyevent HOME
  sleep 1
  adb shell am kill "$PKG"
  sleep 2
  [[ -z "$(adb shell pidof "$PKG" | tr -d '\r')" ]] || fail "the app survived am kill"
}

now=$(adb shell date +%s | tr -d '\r')
due=$(device_date $((now + 150)))
write_note() {
  local name=$1 rule=$2 file="$run/seed-$1.md"
  {
    printf -- '---\nkind: "[[tasks]]"\ncreated: 2026-11-25\ntitle: %s\ndue: %s\n' "$name" "$due"
    [[ -n $rule ]] && printf 'recurrence: %s\n' "$rule"
    printf 'reminders:\n  - %s\n---\nProbe body.\n' "$due"
  } >"$file"
  adb push "$file" "$tasks/$name.md" >/dev/null
}

write_note "Probe Plain" ""
write_note "Probe Daily" "FREQ=DAILY"
write_note "Probe Gone" ""
[[ -n $reschedule ]] && write_note "Probe Later" ""

"$drive" restart >/dev/null
"$drive" wait "task-row:Probe Plain" 30 >/dev/null
sleep 8
"$drive" shot app-before >/dev/null
kill_app
adb shell "rm '$tasks/Probe Gone.md'"
echo "waiting for the reminders, due $due"

titles=("Probe Plain" "Probe Daily" "Probe Gone")
[[ -n $reschedule ]] && titles+=("Probe Later")
deadline=$((SECONDS + 420))
for title in "${titles[@]}"; do
  until [[ $(in_tray "$title") -gt 0 ]]; do
    ((SECONDS < deadline)) || fail "no reminder for $title"
    sleep 5
  done
done

for title in "${titles[@]}"; do
  [[ $title == "Probe Gone" ]] || "$drive" note "Tasks/$title.md" "$title-before" >/dev/null
done
adb shell dumpsys notification --noredact >"$run/tray-before.txt"
grep -c 'actions=2' "$run/tray-before.txt" >/dev/null || fail "no reminder carries buttons"

press_button() {
  local title=$1 button=$2 name=$3
  kill_app
  "$press" "$title" "$button" "$name" >/dev/null || fail "could not press $button on $title"
}

press_button "Probe Plain" Done plain
until [[ "$(note_text "Probe Plain")" == *completed:* ]]; do
  ((SECONDS < deadline + 60)) || fail "Probe Plain never gained completed:"
  sleep 2
done
"$drive" note "Tasks/Probe Plain.md" plain-after >/dev/null
[[ $(in_tray "Probe Plain") -eq 0 ]] || fail "Probe Plain stayed in the tray"

press_button "Probe Daily" Done daily
until [[ "$(note_exists "Probe Daily 2026-11-26")" == yes ]]; do
  ((SECONDS < deadline + 120)) || fail "Probe Daily made no next note"
  sleep 2
done
"$drive" note "Tasks/Probe Daily.md" daily-after >/dev/null
"$drive" note "Tasks/Probe Daily 2026-11-26.md" daily-next >/dev/null
grep -q '^completed:' "$run/note-daily-after.md" || fail "Probe Daily did not gain completed:"
grep -q '^due: 2026-11-26T' "$run/note-daily-next.md" || fail "the next note is not due tomorrow"
[[ $(in_tray "Probe Daily") -eq 0 ]] || fail "Probe Daily stayed in the tray"

if [[ -n $reschedule ]]; then
  press_button "Probe Later" "$reschedule" later
  until ! [[ "$(note_text "Probe Later")" == *"due: $due"* ]]; do
    ((SECONDS < deadline + 180)) || fail "Probe Later's due never moved"
    sleep 2
  done
  "$drive" note "Tasks/Probe Later.md" later-after >/dev/null
  [[ $(in_tray "Probe Later") -eq 0 ]] || fail "Probe Later stayed in the tray"
fi

press_button "Probe Gone" Done gone
until adb shell dumpsys notification --noredact | grep -q "Done did not save"; do
  ((SECONDS < deadline + 240)) || fail "a failed press left no notification"
  sleep 2
done
adb shell dumpsys notification --noredact >"$run/tray-failure.txt"
[[ $(in_tray "Probe Gone") -gt 0 ]] || fail "a failed press cleared the reminder"
adb shell cmd statusbar expand-notifications
sleep 2
adb exec-out screencap -p >"$run/failure-notice.png"
adb shell cmd statusbar collapse

"$drive" restart >/dev/null
"$drive" shot app-failure-list >/dev/null
"$drive" log >/dev/null
echo "pass: Done, Done on a repeating task${reschedule:+, $reschedule}, and a failed press, each with the app killed"
echo "evidence: $run"
