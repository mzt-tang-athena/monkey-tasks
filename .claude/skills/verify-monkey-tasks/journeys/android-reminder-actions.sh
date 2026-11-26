#!/usr/bin/env bash
# Native check on the emulator: the buttons on a reminder work with the
# app killed. It writes tasks that fall due in three minutes, kills the
# app, waits for the reminders, then presses a button on each from the
# notification shade, with the app killed before every press:
#
#   <tag> Plain      Done writes completed and clears the reminder
#   <tag> Daily      Done writes completed and makes the next note
#   <tag> Dropone    Didn't do writes status dropped and no completed
#   <tag> Dropdaily  Didn't do drops this day and makes the next note
#   <tag> Gone       the note is deleted first, so Done fails and says so
#
# The shade fits only a few reminders and the press script does not scroll
# it, so WAVE picks one set per run: tick (the default), drop or snooze.
#
# SNOOZE_CHOICES, in the snooze wave, names the choices to take on
# the Snooze sheet, as a comma list of Later, Tomorrow, "Pick a day" (backs
# out of the picker), "Pick a day and save" and Back. Each one gets its own task. Snooze opens the app on the sheet,
# and the choice must
# land: Later and Tomorrow move the due and clear the reminder. Pick a day
# opens the task on its Due picker and keeps the reminder, even after Back
# from the picker, until a date is saved. Back from the sheet leaves the
# note and the reminder as they were. It defaults to the first four.
#
# Each task's name carries the clock minute of the run, so a second run
# never confuses its reminders with an old one's. Every reminder rings
# on the normal channel with Done, Snooze and Didn't do (ADRs
# 20261125-reminder-actions and 20261111-reminder-weight). Needs an
# instance from android-launch.sh.
#
#   WAVE=snooze SNOOZE_CHOICES="Later,Tomorrow" journeys/android-reminder-actions.sh
#
# Evidence lands in a new run folder: the shade with the buttons, the
# notes before and after each press, and the app log.
set -euo pipefail
here="$(dirname "$0")/../scripts"
drive="$here/android-drive.sh"
press="$here/android-press.sh"
source "$here/android-env.sh"

wave=${WAVE:-tick}
case $wave in
  tick | drop) snooze_choices="" ;;
  snooze) snooze_choices=${SNOOZE_CHOICES:-Later,Tomorrow,Pick a day,Pick a day and save} ;;
  *) echo "WAVE is tick, drop or snooze" >&2; exit 2 ;;
esac
tasks="$VAULT_DIR/Tasks"
run=$("$drive" new-run)
tag=$(adb shell date +%H%M | tr -d '\r')
plain="Probe Plain $tag"
daily="Probe Daily $tag"
dropone="Probe Dropone $tag"
dropdaily="Probe Dropdaily $tag"
gone="Probe Gone $tag"
snooze_title() { echo "Probe Snooze${1// /} $tag"; }
IFS=, read -r -a choices <<<"$snooze_choices"

device_date() { adb shell date -d "@$1" +%Y-%m-%dT%H:%M | tr -d '\r'; }
note_text() { adb shell "cat '$tasks/$1.md'" | tr -d '\r'; }
note_exists() { adb shell "test -f '$tasks/$1.md' && echo yes || echo no" | tr -d '\r'; }
# Only a live record counts: the service's history keeps an "intercepted"
# line for every post, and that line never leaves the dump.
in_tray() { adb shell dumpsys notification --noredact | grep -c "NotificationRecord(.*${1// /%2520}.md:" || true; }
tray_clears() {
  local title=$1 limit=$2
  until [[ $(in_tray "$title") -eq 0 ]]; do
    if ((SECONDS >= limit)); then
      adb shell dumpsys notification --noredact >"$run/tray-stuck.txt"
      "$drive" log >/dev/null || true
      fail "$title stayed in the tray"
    fi
    sleep 2
  done
}
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

now=$(adb shell date +%s | tr -d '\r')
due=$(device_date $((now + 180)))
next_day=$(date -d "${due:0:10} +1 day" +%Y-%m-%d)
next_note="$daily $next_day"
skip_note="$dropdaily $next_day"

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

if [[ $wave == tick ]]; then
  write_note "$plain" ""
  write_note "$daily" "FREQ=DAILY"
  write_note "$gone" ""
elif [[ $wave == drop ]]; then
  write_note "$dropone" ""
  write_note "$dropdaily" "FREQ=DAILY"
fi
for choice in "${choices[@]}"; do write_note "$(snooze_title "$choice")" ""; done

"$drive" restart >/dev/null
# The row can sit below the repair banner, and uiautomator reports only
# what is on screen, so the journey scrolls to it.
first_probe=$(ls "$run"/seed-*.md | head -1)
first_probe=${first_probe##*/seed-}
"$drive" scroll-to "task-row:${first_probe%.md}" >/dev/null || fail "the app shows no probe row"
sleep 8
"$drive" shot app-before >/dev/null
kill_app
[[ $wave == tick ]] && adb shell "rm '$tasks/$gone.md'"
echo "waiting for the reminders, due $due"

titles=()
[[ $wave == tick ]] && titles=("$plain" "$daily" "$gone")
[[ $wave == drop ]] && titles=("$dropone" "$dropdaily")
for choice in "${choices[@]}"; do titles+=("$(snooze_title "$choice")"); done
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
for label in Done Snooze "Didn't do"; do
  grep -q "\] \"$label\"" "$run/tray-before.txt" || fail "no reminder shows $label"
done
for label in Later Tomorrow; do
  grep -q "\] \"$label\"" "$run/tray-before.txt" && fail "a reminder still shows $label"
done
grep -q 'channel=reminder-normal' "$run/tray-before.txt" || fail "no reminder rang on reminder-normal"
grep -q 'channel=reminder-alarm' "$run/tray-before.txt" && fail "a plain reminder rang as an alarm"

press_button() {
  local title=$1 button=$2 name=$3
  kill_app
  "$press" "$title" "$button" "$name" >/dev/null || fail "could not press $button on $title"
}

if [[ $wave == tick ]]; then
  press_button "$plain" Done plain
  until [[ "$(note_text "$plain")" == *completed:* ]]; do
    ((SECONDS < deadline + 60)) || fail "$plain never gained completed:"
    sleep 2
  done
  "$drive" note "Tasks/$plain.md" plain-after >/dev/null
  tray_clears "$plain" $((deadline + 90))

  press_button "$daily" Done daily
  until [[ "$(note_exists "$next_note")" == yes ]]; do
    ((SECONDS < deadline + 120)) || fail "$daily made no next note"
    sleep 2
  done
  "$drive" note "Tasks/$daily.md" daily-after >/dev/null
  "$drive" note "Tasks/$next_note.md" daily-next >/dev/null
  grep -q '^completed:' "$run/note-daily-after.md" || fail "$daily did not gain completed:"
  grep -q "^due: $next_day" "$run/note-daily-next.md" || fail "the next note is not due tomorrow"
  tray_clears "$daily" $((deadline + 150))
fi

if [[ $wave == drop ]]; then
  press_button "$dropone" "Didn't do" dropone
  until [[ "$(note_text "$dropone")" == *dropped* ]]; do
    ((SECONDS < deadline + 160)) || fail "$dropone never gained status: dropped"
    sleep 2
  done
  "$drive" note "Tasks/$dropone.md" dropone-after >/dev/null
  grep -q '^status: "\?\[\[dropped\]\]"\?$' "$run/note-dropone-after.md" || fail "$dropone did not gain status [[dropped]]"
  grep -q '^completed:' "$run/note-dropone-after.md" && fail "$dropone dropped with a completed date"
  [[ $(note_exists "$dropone $next_day") == no ]] || fail "a one-off made a next note"
  tray_clears "$dropone" $((deadline + 170))

  press_button "$dropdaily" "Didn't do" dropdaily
  until [[ "$(note_exists "$skip_note")" == yes ]]; do
    ((SECONDS < deadline + 180)) || fail "$dropdaily made no next note"
    sleep 2
  done
  "$drive" note "Tasks/$dropdaily.md" dropdaily-after >/dev/null
  "$drive" note "Tasks/$skip_note.md" dropdaily-next >/dev/null
  grep -q '^status: "\?\[\[dropped\]\]"\?$' "$run/note-dropdaily-after.md" || fail "$dropdaily did not gain status [[dropped]]"
  grep -q '^completed:' "$run/note-dropdaily-after.md" && fail "$dropdaily dropped with a completed date"
  grep -q "^due: $next_day" "$run/note-dropdaily-next.md" || fail "the next note is not due tomorrow"
  grep -q '^status:' "$run/note-dropdaily-next.md" && fail "the next note carries a status"
  tray_clears "$dropdaily" $((deadline + 190))
fi

if [[ $wave == snooze ]]; then
  # Snooze opens the app, so the sheet shows on a cold start. The choice
  # is tapped on the sheet, with the app up.
  step=0
  for choice in "${choices[@]}"; do
    title=$(snooze_title "$choice")
    press_button "$title" Snooze "snooze-${choice// /}"
    "$drive" wait "Pick a day" 120 >/dev/null || fail "the Snooze sheet did not open for $title"
    "$drive" shot "snooze-sheet-${choice// /}" >/dev/null
    case $choice in
      Back)
        adb shell input keyevent KEYCODE_BACK
        "$drive" gone "Pick a day" 20 >/dev/null || fail "Back left the Snooze sheet open"
        sleep 3
        [[ "$(note_text "$title")" == *"due: $due"* ]] || fail "$title changed after Back"
        [[ $(in_tray "$title") -gt 0 ]] || fail "Back cleared the reminder of $title"
        "$drive" shot snooze-back >/dev/null
        ;;
      "Pick a day")
        # The editor's own Due tile shares the picker's name, so the picker
        # is told by its Next week chip. Backing out of the picker saves nothing, so the note and the
        # reminder stay as they were.
        "$drive" tap "Pick a day" >/dev/null
        "$drive" wait "Next week" 60 >/dev/null || fail "Pick a day did not open the Due picker"
        "$drive" shot snooze-pick-due >/dev/null
        adb shell input keyevent KEYCODE_BACK
        "$drive" gone "Next week" 20 >/dev/null || fail "Back left the Due picker open"
        adb shell input keyevent KEYCODE_BACK
        sleep 3
        [[ "$(note_text "$title")" == *"due: $due"* ]] || fail "$title changed after Back from Pick a day"
        [[ $(in_tray "$title") -gt 0 ]] || fail "Back from Pick a day cleared the reminder of $title"
        "$drive" shot snooze-pick-back >/dev/null
        ;;
      "Pick a day and save")
        # A saved date moves the due and clears the reminder it answered.
        "$drive" tap "Pick a day" >/dev/null
        "$drive" wait "Next week" 60 >/dev/null || fail "Pick a day did not open the Due picker"
        [[ $(in_tray "$title") -gt 0 ]] || fail "opening the Due picker cleared the reminder of $title"
        "$drive" tap "Tomorrow" >/dev/null
        until ! [[ "$(note_text "$title")" == *"due: $due"* ]]; do
          ((SECONDS < deadline + 420 + step * 30)) || fail "$title's due never moved"
          sleep 2
        done
        "$drive" note "Tasks/$title.md" snooze-save-after >/dev/null
        "$drive" shot snooze-pick-saved >/dev/null
        grep -q "^due: ${next_day}T${due:11}$" "$run/note-snooze-save-after.md" || fail "$title's due is not $next_day at the same time"
        tray_clears "$title" $((deadline + 440 + step * 30))
        ;;
      *)
        "$drive" tap "$choice" >/dev/null
        until ! [[ "$(note_text "$title")" == *"due: $due"* ]]; do
          ((SECONDS < deadline + 420 + step * 30)) || fail "$title's due never moved"
          sleep 2
        done
        "$drive" note "Tasks/$title.md" "snooze-${choice// /}-after" >/dev/null
        tray_clears "$title" $((deadline + 440 + step * 30))
        after="$run/note-snooze-${choice// /}-after.md"
        new_due=$(grep '^due:' "$after" | cut -d' ' -f2)
        [[ $(grep -c '^  - ' "$after") -eq 1 && "$(sed -n 's/^  - //p' "$after")" == "$new_due" ]] ||
          fail "$title's reminders is not the one new moment $new_due"
        ahead=$(( $(TZ=Pacific/Auckland date -d "$new_due" +%s) - $(adb shell date +%s | tr -d '\r') ))
        case $choice in
          Later) ((ahead > 3000 && ahead <= 3900)) && [[ ${new_due: -1} =~ [05] ]] || fail "Later set $new_due, $ahead s ahead, not an hour on in five minutes" ;;
          Tomorrow) [[ $new_due == "$next_day"T09:00 ]] || fail "Tomorrow set $new_due, not $next_day 09:00" ;;
        esac
        ;;
    esac
    ((step += 1))
  done
fi

if [[ $wave == tick ]]; then
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

  # A failed press gives its claim back, so the same button acts again.
  # The note comes back, and the press that just failed must now land.
  "$drive" note "Tasks/$gone.md" gone-missing >/dev/null || true
  write_note "$gone" ""
  press_button "$gone" Done gone-retry
  until [[ "$(note_text "$gone")" == *completed:* ]]; do
    ((SECONDS < deadline + 300)) || fail "a second press on the failed reminder did nothing"
    sleep 2
  done
  "$drive" note "Tasks/$gone.md" gone-after-retry >/dev/null
  tray_clears "$gone" $((deadline + 360))
fi

# The failure banner and the repair banner can push every row below the
# fold, and the restart waits for a visible one. The app is up either
# way, so the journey scrolls to a row it knows.
adb shell cmd statusbar collapse
"$drive" restart >/dev/null || true
"$drive" shot app-failure-list >/dev/null
"$drive" log >/dev/null
case $wave in
  tick) what="Done, Done on a repeat, and a failed press" ;;
  drop) what="Didn't do on a one-off and on a repeat" ;;
  snooze) what="Snooze ($snooze_choices)" ;;
esac
echo "pass: $what, each with the app killed"
echo "evidence: $run"
