---
title: A drop shows the new order without a flicker
created: 2026-11-26
priority: normal
assignee: claude-lane-drop-flicker
pr: 244
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

The drop drew the old order for one frame on the 1.3.0 APK and in the
web suite. The surface cleared its ghost and shifts before the caller's
optimistic write reached React. The mutation waits a yield before it
calls `onMutate`. TanStack told the query's subscribers on a timer.

The caller's write now runs first. Cache notifications flush in a
microtask. The write and the clear share one commit (ADR 0032 and
20261126-a-drop-and-its-write-share-a-commit).

The Board shares the surface and the fix. The new e2e samples every
commit through a drop on a paused clock. It fails on the base in both
projects for the lists, and in reduced motion for the board. Frames
from the fixed APK show the preview then the new order, with motion on
and off.

One frame after the drop can still draw the moved row at its old
offset. The UI thread applies the new style a frame later. That
predates this change and is a separate fault in the ADR.
