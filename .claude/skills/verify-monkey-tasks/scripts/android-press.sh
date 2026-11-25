#!/usr/bin/env bash
# Press a button on one reminder in the notification shade, on the
# emulator android-launch.sh started. It opens the shade, opens the
# app's group and the notification, and taps the button. Screens go to
# the run folder as <name>-shade-N.png, and the last one before the tap
# is <name>-buttons.png.
#
#   android-press.sh <title> <button> <name>
set -euo pipefail
source "$(dirname "$0")/android-env.sh"
drive="$(dirname "$0")/android-drive.sh"

title=${1:?title} button=${2:?button} name=${3:?name}
run=$("$drive" run)

adb shell cmd statusbar expand-notifications
for step in 1 2 3 4 5 6; do
  sleep 2
  adb exec-out screencap -p >"$run/$name-shade-$step.png"
  "$drive" peek >/dev/null
  read -r verb x y < <(node "$(dirname "$0")/android-shade.mjs" "$UIXML" "$title" "$button")
  case $verb in
    press)
      cp "$run/$name-shade-$step.png" "$run/$name-buttons.png"
      adb shell input tap "$x" "$y"
      echo "pressed $button on $title"
      exit 0
      ;;
    expand) adb shell input tap "$x" "$y" ;;
    *)
      echo "android-press: $title is not in the shade" >&2
      exit 1
      ;;
  esac
done
echo "android-press: never reached $button on $title" >&2
exit 1
