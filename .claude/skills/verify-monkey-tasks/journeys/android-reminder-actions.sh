#!/usr/bin/env bash
# Native check on the emulator: the buttons on a reminder work with the
# app killed. It writes four tasks that fall due in three minutes, kills
# the app, waits for the reminders, then presses a button on each from
# the notification shade, with the app killed before every press:
#
#   <tag> Plain   Done writes completed
#   <tag> Daily   Done writes completed and makes the next note
#   <tag> Later   the Reschedule button moves the due and the reminder
#   <tag> Gone    the note is deleted first, so Done fails and says so
#
# Each task's name carries the clock minute of the run, so a second run
# never confuses its reminders with an old one's. Needs an instance from
# android-launch.sh. RESCHEDULE_BUTTON names the Reschedule button to
# press. With none set, that task is not written.
#
#   RESCHEDULE_BUTTON=Later journeys/android-reminder-actions.sh
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
tag=$(adb shell date +%H%M | tr -d '\r')
plain="Probe Plain $tag"
daily="Probe Daily $tag"
later="Probe Later $tag"
gone="Probe Gone $tag"

device_date() { adb shell date -d "@$1" +%Y-%m-%dT%H:%M | tr -d '\r'; }
note_text() { adb shell "cat '$tasks/$1.md'" | tr -d '\r'; }
note_exists() { adb shell "test -f '$tasks/$1.md' && echo yes || echo no" | tr -d '\r'; }
in_tray() { adb shell dumpsys notification --noredact | grep -c "${1// /%2520}.md:" || true; }
fail() { echo "FAIL: $*" >&2; echo "evidence: $run" >&2; exit 1; }

# am kill takes a cached process only, so the app must be off screen
# first. HOME can land before the app draws, so this waits for the
# launcher and tries again.
kill_app() {
  local try
  for try in 1 2 3 4 5; do
    adb shell cmd statusbar collapse
    adb shell input keyevent HOME
    sleep 2
    adb shell dumpsys activity activities | grep -q "topResumedActivity.*nexuslauncher" || continue
    adb shell am kill "$PKG"
    sleep 2
    [[ -z "$(adb shell pidof "$PKG" | tr -d '\r')" ]] && return 0
  done
  fail "the app survived am kill"
}

# A shade left open by an earlier run covers the app, and then no task
# row can show.
adb shell cmd statusbar collapse
now=$(adb shell date +%s | tr -d '\r')
due=$(device_date $((now + 180)))
next_day=$(date -d "${due:0:10} +1 day" +%Y-%m-%d)
next_note="$daily $next_day"

write_note() {
  local name=$1 rule=$2 file="$run/seed-$1.md"
  {
    printf -- '---\nkind: "[[tasks]]"\ncreated: 2026-11-25\ntitle: %s\ndue: %s\n' "$name" "$due"
    [[ -n $rule ]] && printf 'recurrence: %s\n' "$rule"
    printf 'reminders:\n  - %s\n---\nProbe body.\n' "$due"
  } >"$file"
  adb push "$file" "$tasks/$name.md" >/dev/null
}

# An earlier run leaves its own probes behind, and a second set of
# reminders would make this run's tray ambiguous.
adb shell "rm -f $tasks/Probe*"

write_note "$plain" ""
write_note "$daily" "FREQ=DAILY"
write_note "$gone" ""
[[ -n $reschedule ]] && write_note "$later" ""

"$drive" restart >/dev/null
# The row can sit below the repair banner, and uiautomator reports only
# what is on screen, so the journey scrolls to it.
"$drive" scroll-to "task-row:$plain" >/dev/null || fail "the app shows no $plain row"
sleep 8
"$drive" shot app-before >/dev/null
kill_app
adb shell "rm '$tasks/$gone.md'"
echo "waiting for the reminders, due $due"

titles=("$plain" "$daily" "$gone")
[[ -n $reschedule ]] && titles+=("$later")
deadline=$((SECONDS + 420))
for title in "${titles[@]}"; do
  until [[ $(in_tray "$title") -gt 0 ]]; do
    ((SECONDS < deadline)) || fail "no reminder for $title"
    sleep 5
  done
done

for title in "${titles[@]}"; do
  [[ $title == "$gone" ]] || "$drive" note "Tasks/$title.md" "$title-before" >/dev/null
done
adb shell dumpsys notification --noredact >"$run/tray-before.txt"
grep -q 'actions=[2-9]' "$run/tray-before.txt" || fail "no reminder carries buttons"
for label in Done Later Tomorrow; do
  grep -q "\] \"$label\"" "$run/tray-before.txt" || fail "no reminder shows $label"
done

press_button() {
  local title=$1 button=$2 name=$3
  kill_app
  "$press" "$title" "$button" "$name" >/dev/null || fail "could not press $button on $title"
}

press_button "$plain" Done plain
until [[ "$(note_text "$plain")" == *completed:* ]]; do
  ((SECONDS < deadline + 60)) || fail "$plain never gained completed:"
  sleep 2
done
"$drive" note "Tasks/$plain.md" plain-after >/dev/null
[[ $(in_tray "$plain") -eq 0 ]] || fail "$plain stayed in the tray"

press_button "$daily" Done daily
until [[ "$(note_exists "$next_note")" == yes ]]; do
  ((SECONDS < deadline + 120)) || fail "$daily made no next note"
  sleep 2
done
"$drive" note "Tasks/$daily.md" daily-after >/dev/null
"$drive" note "Tasks/$next_note.md" daily-next >/dev/null
grep -q '^completed:' "$run/note-daily-after.md" || fail "$daily did not gain completed:"
grep -q "^due: $next_day" "$run/note-daily-next.md" || fail "the next note is not due tomorrow"
[[ $(in_tray "$daily") -eq 0 ]] || fail "$daily stayed in the tray"

if [[ -n $reschedule ]]; then
  press_button "$later" "$reschedule" later
  until ! [[ "$(note_text "$later")" == *"due: $due"* ]]; do
    ((SECONDS < deadline + 180)) || fail "$later's due never moved"
    sleep 2
  done
  "$drive" note "Tasks/$later.md" later-after >/dev/null
  [[ $(in_tray "$later") -eq 0 ]] || fail "$later stayed in the tray"
fi

press_button "$gone" Done gone
until adb shell dumpsys notification --noredact | grep -q "Done did not save"; do
  ((SECONDS < deadline + 240)) || fail "a failed press left no notification"
  sleep 2
done
adb shell dumpsys notification --noredact >"$run/tray-failure.txt"
[[ $(in_tray "$gone") -gt 0 ]] || fail "a failed press cleared the reminder"
adb shell cmd statusbar expand-notifications
sleep 2
adb exec-out screencap -p >"$run/failure-notice.png"
adb shell cmd statusbar collapse

"$drive" restart >/dev/null
"$drive" shot app-failure-list >/dev/null
"$drive" log >/dev/null
echo "pass: Done, Done on a repeating task${reschedule:+, $reschedule}, and a failed press, each with the app killed"
echo "evidence: $run"
