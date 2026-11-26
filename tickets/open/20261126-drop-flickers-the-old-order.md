---
title: A drop shows the new order without a flicker
created: 2026-11-26
priority: normal
assignee:
pr:
depends: []
---

## Spec

The operator's feedback on 2026-11-26, on the 1.3.0 phone build. A row
dragged to a new place in a list drops there. Then the rows flash back
to the old order for a moment, and snap to the new one.

- Reproduce it on the emulator with a release APK first. Record frames
  through the drop, with motion on and off.
- Find which render shows the old order. Candidates: the optimistic
  write, the vault re-read, or the reorder surface letting go before
  the new order lands.
- ADRs `0032-the-list-keeps-its-order-during-a-drag` and
  `20261124-a-drop-rebases-on-the-rows-it-shows` cover this path.
- Check the Board's drag too, since it shares the reorder surface.

## Acceptance

- [ ] Frames show the flash before the fix.
- [ ] The report names the render that drew the old order.
- [ ] Frames show no old-order frame after the fix.
- [ ] A test fails when the old order draws after a drop.

## Outcome

(filled in before moving to done/)
