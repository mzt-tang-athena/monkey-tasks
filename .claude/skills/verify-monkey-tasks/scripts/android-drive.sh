#!/usr/bin/env bash
# Drive the app on the emulator that android-launch.sh started, and keep
# evidence in the run folder it made. One step per call:
#
#   android-drive.sh tap <handle>                 tap a node, waiting up to 20 s for it
#   android-drive.sh wait <handle> [secs]         wait until a node shows
#   android-drive.sh gone <handle> [secs]         wait until a node is gone
#   android-drive.sh has <handle>                 exit 0 when a node shows now
#   android-drive.sh bounds <handle>              print "x y left top right bottom"
#   android-drive.sh text <handle>                print a node's text
#   android-drive.sh peek                         read the screen tree into $UIXML only
#   android-drive.sh type <text>                  type into the focused field
#   android-drive.sh key <keycode>                BACK, ENTER, ESCAPE, ...
#   android-drive.sh swipe <handle> <dx> <dy> [ms]       swipe from a node's center
#   android-drive.sh drag <handle> <dx> <dy> [ms]        long press, then move
#   android-drive.sh hold-drag <handle> <dx> <dy> [hold ms]  press, hold, move in steps
#   android-drive.sh shot <name>                  screenshot to <run>/<name>.png
#   android-drive.sh dump <name>                  screen tree to <run>/<name>.xml and .txt
#   android-drive.sh record <name> <secs> <step...>   record the screen while one step runs
#   android-drive.sh frames <name> <secs> <step...>   every frame while one step runs and secs after, as PNGs and a grid
#   android-drive.sh scroll-to <handle> [up|down]     scroll the page until a node shows
#   android-drive.sh note <vault path> [name]     print a note, keep a copy in the run
#   android-drive.sh log [name]                   app log to <run>/<name>.log
#   android-drive.sh motion on|off                set the three animation scales, restart the app
#   android-drive.sh restart                      stop and start the app, wait for a task row
#   android-drive.sh list                         print every labelled node on screen
#   android-drive.sh run                          print the run folder
#   android-drive.sh new-run                      start a new run folder
#
# A handle is an accessibility label, a testID or visible text, matched
# exactly. Prefix it with ~ for a substring match. `outer>>inner` finds
# inner inside outer. `@x,y` is a raw point: use it after `bounds` so
# that a burst or record spends no frames on the lookup. See
# android-ui.mjs.
set -euo pipefail
source "$(dirname "$0")/android-env.sh"

FIRST_ROW="~task-row:"

die() { echo "android-drive: $*" >&2; exit 1; }

run_dir() {
  local run
  run=$(state_get run)
  [[ -n "$run" ]] || run=$(new_run)
  mkdir -p "$run"
  echo "$run"
}

dump_ui() {
  local i
  for i in 1 2 3; do
    if adb shell uiautomator dump /data/local/tmp/verify-ui.xml >/dev/null 2>&1; then
      adb exec-out cat /data/local/tmp/verify-ui.xml >"$UIXML"
      return 0
    fi
    sleep 1
  done
  die "uiautomator dump failed three times"
}

# System UI dialogs that block every step on a loaded host. "Wait" keeps
# the stalled process alive, which is what a user would do.
clear_system_dialogs() {
  local at
  if at=$(node "$UI" "$UIXML" find aerr_wait); then
    set -- $at
    adb shell input tap "$1" "$2"
    sleep 1
    return 0
  fi
  return 1
}

# Print the bounds of a handle, waiting up to $2 seconds.
find_node() {
  local handle=$1 deadline=$((SECONDS + ${2:-20})) at
  # @x,y is a point already known, so frames start on the gesture.
  if [[ $handle =~ ^@([0-9]+),([0-9]+)$ ]]; then
    echo "${BASH_REMATCH[1]} ${BASH_REMATCH[2]}"
    return 0
  fi
  while :; do
    dump_ui
    if at=$(node "$UI" "$UIXML" find "$handle"); then
      echo "$at"
      return 0
    fi
    clear_system_dialogs || true
    ((SECONDS < deadline)) || return 1
    sleep 0.5
  done
}

center() { set -- $1; echo "$1 $2"; }

clamp() { local v=$1 max=$2; ((v < 1)) && v=1; ((v > max - 1)) && v=$((max - 1)); echo "$v"; }

wait_first_row() {
  find_node "$FIRST_ROW" "${1:-60}" >/dev/null || die "no task row after ${1:-60} s"
}

start_app() {
  adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
}

cmd=${1:-}
[[ -n "$cmd" ]] || die "no step given. See the top of this file."
shift

case "$cmd" in
  tap)
    at=$(find_node "${1:?handle}" 20) || die "no node '$1' on screen"
    adb shell input tap $(center "$at")
    echo "tapped '$1' at $(center "$at")"
    ;;
  wait)
    find_node "${1:?handle}" "${2:-20}" >/dev/null || die "'$1' did not show in ${2:-20} s"
    echo "'$1' shows"
    ;;
  gone)
    deadline=$((SECONDS + ${2:-20}))
    while dump_ui && node "$UI" "$UIXML" find "${1:?handle}" >/dev/null; do
      ((SECONDS < deadline)) || die "'$1' still shows after ${2:-20} s"
      sleep 0.5
    done
    echo "'$1' is gone"
    ;;
  has)
    dump_ui
    node "$UI" "$UIXML" find "${1:?handle}" >/dev/null
    ;;
  bounds)
    find_node "${1:?handle}" 20 || die "no node '$1' on screen"
    ;;
  text)
    find_node "${1:?handle}" "${2:-20}" >/dev/null || die "no node '$1' on screen"
    node "$UI" "$UIXML" text "$1"
    ;;
  peek)
    dump_ui
    clear_system_dialogs && dump_ui || true
    ;;
  type)
    text=${1:?text}
    # `input text` reads %s as a space. Quote for the device shell.
    text=${text// /%s}
    text=${text//\'/\'\\\'\'}
    adb shell "input text '$text'"
    ;;
  key)
    adb shell input keyevent "KEYCODE_${1:?keycode}"
    ;;
  swipe | drag)
    at=$(find_node "${1:?handle}" 20) || die "no node '$1' on screen"
    set -- $(center "$at") "${2:?dx}" "${3:?dy}" "${4:-}"
    # Keep the end on screen. An end off the edge reads as a system gesture.
    x2=$(clamp $(($1 + $3)) "$SCREEN_W") y2=$(clamp $(($2 + $4)) "$SCREEN_H")
    if [[ $cmd == swipe ]]; then
      adb shell input swipe "$1" "$2" "$x2" "$y2" "${5:-300}"
    else
      adb shell input draganddrop "$1" "$2" "$x2" "$y2" "${5:-1500}"
    fi
    echo "$cmd from $1,$2 to $x2,$y2"
    ;;
  hold-drag)
    at=$(find_node "${1:?handle}" 20) || die "no node '$1' on screen"
    set -- $(center "$at") "${2:?dx}" "${3:?dy}" "${4:-600}"
    hold=$(awk "BEGIN { print $5 / 1000 }")
    script="input motionevent DOWN $1 $2; sleep $hold"
    for step in 1 2 3 4 5 6 7 8; do
      script+="; input motionevent MOVE $(($1 + $3 * step / 8)) $(($2 + $4 * step / 8))"
    done
    script+="; sleep 0.3; input motionevent UP $(($1 + $3)) $(($2 + $4))"
    adb shell "$script"
    echo "hold-drag from $1,$2 by $3,$4 after ${5} ms"
    ;;
  shot)
    out="$(run_dir)/${1:?name}.png"
    adb exec-out screencap -p >"$out"
    echo "$out"
    ;;
  dump)
    run=$(run_dir)
    dump_ui
    cp "$UIXML" "$run/${1:?name}.xml"
    node "$UI" "$UIXML" list >"$run/$1.txt"
    echo "$run/$1.xml"
    ;;
  record)
    name=${1:?name} secs=${2:?secs}
    shift 2
    [[ $# -gt 0 ]] || die "record needs a step to run, for example: record swipe 6 swipe '~task-row:' -600 0"
    remote="/data/local/tmp/verify-$name.mp4"
    adb shell screenrecord --time-limit "$secs" "$remote" &
    recorder=$!
    sleep 1
    "$0" "$@"
    wait "$recorder" || true
    out="$(run_dir)/$name.mp4"
    adb pull -q "$remote" "$out"
    adb shell rm -f "$remote"
    echo "$out"
    ;;
  frames)
    name=${1:?name} secs=${2:?secs}
    shift 2
    [[ $# -gt 0 ]] || die "frames needs a step to run, for example: frames swipe 2 swipe @541,1374 -600 0"
    remote="/data/local/tmp/verify-$name.raw"
    adb shell "screenrecord --output-format=frames --size 270x600 $remote" &
    recorder=$!
    sleep 1
    "$0" "$@"
    sleep "$secs"
    # Frames mode ignores --time-limit. SIGINT ends it cleanly.
    adb shell pkill -INT screenrecord || true
    wait "$recorder" || true
    out="$(run_dir)/$name-frames"
    rm -rf "$out"
    mkdir -p "$out"
    adb pull -q "$remote" "$out/frames.raw"
    adb shell rm -f "$remote"
    node "$SKILL_DIR/scripts/android-frames.mjs" "$out/frames.raw" "$out" >/dev/null
    rm -f "$out/frames.raw"
    echo "$out/sheet.png"
    ;;
  scroll-to)
    handle=${1:?handle} way=${2:-down}
    dump_ui
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      # Shown means clear of the tab strip and the bottom bar.
      if at=$(node "$UI" "$UIXML" find "$handle") && set -- $at && (($4 >= 300 && $6 <= 2100)); then
        echo "'$handle' shows at $1 $2"
        exit 0
      fi
      if [[ $way == down ]]; then
        adb shell input swipe 540 1700 540 1100 400
      else
        adb shell input swipe 540 1100 540 1700 400
      fi
      sleep 0.8
      dump_ui
    done
    die "'$handle' did not show after ten scrolls $way"
    ;;
  note)
    path=${1:?vault path, for example "Tasks/Call Mum.md"}
    name=${2:-$(basename "$path" .md)}
    out="$(run_dir)/note-$name.md"
    adb exec-out cat "$VAULT_DIR/$path" >"$out" || die "no note $VAULT_DIR/$path"
    cat "$out"
    ;;
  log)
    out="$(run_dir)/${1:-app}.log"
    pid=$(adb shell pidof "$PKG" | tr -d '\r' || true)
    adb logcat -d -v time ReactNativeJS:V ReactNative:V AndroidRuntime:E '*:S' >"$out"
    [[ -n "$pid" ]] && adb logcat -d -v time --pid="$pid" >"${out%.log}-pid.log"
    echo "$out"
    ;;
  motion)
    case "${1:-}" in on) scale=1 ;; off) scale=0 ;; *) die "motion on|off" ;; esac
    for key in animator_duration_scale transition_animation_scale window_animation_scale; do
      adb shell settings put global "$key" "$scale"
    done
    "$0" restart
    echo "motion $1"
    ;;
  restart)
    adb shell am force-stop "$PKG"
    # The dying window lingers in the screen tree for a moment. Wait for
    # it to go, so the next wait reads the new process.
    deadline=$((SECONDS + 10))
    while dump_ui && node "$UI" "$UIXML" find "$FIRST_ROW" >/dev/null && ((SECONDS < deadline)); do
      sleep 0.5
    done
    start_app
    # A cold start on a loaded host took over 60 s.
    wait_first_row 180
    echo "app restarted"
    ;;
  list)
    dump_ui
    node "$UI" "$UIXML" list
    ;;
  run) run_dir ;;
  new-run) new_run ;;
  *) die "unknown step '$cmd'. See the top of this file." ;;
esac
