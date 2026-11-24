---
title: The smoke's theme step reaches Settings again
created: 2026-11-21
priority: normal
assignee: opencode
pr:
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

- [ ] The theme step opens Settings on the current APK.
- [ ] A missing handle fails the smoke, shown once.
- [ ] The step proves the theme changed, from a screenshot or a dump.

## Outcome

(filled in before moving to done/)
