---
title: The smoke's theme step reaches Settings again
created: 2026-11-21
priority: normal
assignee: opencode
pr: 218
depends: []
---

## Spec

The release smoke switches the theme to check that the app repaints.
Its step taps `open settings`, a handle the app lost in #168. The tap
finds nothing, so the step has checked nothing since 1.2. The smoke
never noticed, because a missed tap does not fail the run.

- Reach Settings the way a user does today, found on the screen.
- A tap that finds no node fails the step.
- The theme check reads a color change, not only a tap that landed.

## Acceptance

- [x] The theme step opens Settings on the current APK.
- [x] A missing handle fails the smoke, shown once.
- [x] The step proves the theme changed, from a screenshot or a dump.

## Outcome

The theme step reaches Settings from the bar's opener and its row in the
pane. It reads the repaint from a colour change.

- The head's smoke on the 1.2.0 APK: 38 PASS and 0 FAIL, `smoke: pass`.
  The theme step reads luma 230 on Settings and 40 on Midnight.
- A missing handle fails the step once. Run with the lost
  `open settings`, it counts one FAIL where the old step passed.
- `android-color.mjs` reads a shot's mean colour. `png.mjs` holds the
  reader it shares with `android-handle.mjs`.
