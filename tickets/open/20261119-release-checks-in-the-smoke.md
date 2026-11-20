---
title: Release checks live in the release smoke
created: 2026-11-19
priority: normal
assignee:
pr:
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

- [ ] The smoke covers the gap swipe and the three-button editor.
- [ ] The smoke runs the keyboard journey, or says why not.
- [ ] One launch covers the whole release pass.
- [ ] No step taps a row it has not found on screen.
- [ ] The verify skill's release section names the new steps.

## Outcome

(filled in before moving to done/)
