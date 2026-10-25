---
id: 0030
title: Fast motion for the moments that feel slow
created: 2026-10-23
priority: normal
assignee: omp
pr:
depends: [0021, 0023]
---

## Spec

The app works. These animations make it feel like it does. Every one
runs under 200 ms, because a task app that waits on its own motion is
worse than one with none.

- Swiping the list tab or the day planner follows the finger, then
  settles on the next page. A short swipe springs back.
- Ticking a task plays a fast check: the circle fills and the row fades
  to its completed weight.
- Holding a planner row shows readiness at `drag.holdMs`: a light
  shake and the lifted style, before the drag starts.
- Sending a capture lands the new row with a short rise and fade.
- Opening the source menu scales in from the chip, and the backdrop
  fades.

All motion respects the system reduce-motion setting: with it on, the
end states apply immediately.

## Acceptance

- [x] A horizontal swipe drags the page with the finger and settles in
      under 200 ms.
- [x] A swipe under the threshold springs back.
- [x] Ticking shows the check before the write lands.
- [x] A hold shows the shake and the lifted style at the hold mark.
- [x] A sent capture lands with the rise and fade.
- [x] The source menu scales in from its chip.
- [x] Reduce motion turns every one of these into an instant change.
- [x] No animation runs on a scroll or a tap that does not change state.

## Outcome

The list and the planner day page follow the finger. The tripwire
reports its travel, the page rides a translate, and a release settles
on the next page in 160 ms or springs back. The offset resets in a
layout effect keyed on the page, so the next page paints in place
instead of flashing the old one.

The tick shows at once: the circle pops and the row dims while the
note is written, and the data wins again as soon as it agrees. The
hold shakes the source once when the drag arms. A capture rises into
place on the lists screen, in the planner rows, and in the pills.

Every one of these reads the system reduce motion switch through one
hook. With the switch on, the end state applies at once and nothing
moves.

One cost worth naming: the floating row and the swipe still read the
pointer on the JS thread (ADR 0019). The work per event is a setValue
and a hit test, and the animations run on the native driver.
