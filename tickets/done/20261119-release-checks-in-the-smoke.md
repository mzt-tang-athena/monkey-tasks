---
title: Release checks live in the release smoke
created: 2026-11-19
priority: normal
assignee: omp
pr: 204
depends: [20261119-launch-answers-notification-prompt]
---

## Spec

The 1.2 release pass ran its new checks from a wrapper in `/tmp`:

- A swipe on the bar's gap opens the command pane.
- The task editor clears three-button navigation.
- The editor keyboard journey.

The wrapper launched the emulator a second time. It also tapped a row
by a fixed name that was not on screen, so one check ran again.

Move the checks worth keeping into `android-release-smoke.sh` as steps.
A release then needs one launch and no wrapper. Pick rows from the
current screen, not from a fixed name.

## Acceptance

- [x] The smoke covers the gap swipe and the three-button editor.
- [x] The smoke runs the keyboard journey, or says why not.
- [x] One launch covers the whole release pass.
- [x] No step taps a row it has not found on screen.
- [x] The verify skill's release section names the new steps.

## Outcome

One launch runs the whole release pass on the emulator:

- A downward swipe on the bar's gap opens the command pane. Eleven
  commands show, and Close shuts it.
- The editor's bottom sits 21 px above the three-button nav bar, both
  read from one dump.
- The editor keyboard journey runs inside the smoke, one try per mode.
- The new steps take the row the screen shows, never a fixed name.
- A refused port ends the run, instead of driving another lane's
  emulator.
- The launch bounds `adb wait-for-device` at 180 s, so a missing
  emulator fails the pass and frees the heavy lock.
- Cleanup puts the keyboard flag and gesture navigation back.

Proof, 1.2.0 release APK, `emulator-5582`, one launch:

- Pass: `app/build/verify/evidence/android-20261121-033145`.
- Keyboard: `app/build/verify/evidence/android-20261121-033901`.
- The pass names the pull that opened the pane: down on 1.2.0.
- Logs, frames, the guard and the wait-bound demo:
  `~/code/monkey-tasks/worktrees/evidence-release-smoke/`.

Base smoke, found in this pass and left as is:

- The journal, food and Inbox writes lost a character in the first
  pass and passed in the second. `input text` at full speed can drop a
  key in a controlled field on a slow host.
- The theme step taps `open settings`, a handle the app lost in #168.
  It has switched nothing since 1.2.

Next: ticket `20261120-release-script` calls this smoke from
`scripts/release.sh`.
