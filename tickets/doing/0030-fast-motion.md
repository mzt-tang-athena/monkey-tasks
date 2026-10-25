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

- [ ] A horizontal swipe drags the page with the finger and settles in
      under 200 ms.
- [ ] A swipe under the threshold springs back.
- [ ] Ticking shows the check before the write lands.
- [ ] A hold shows the shake and the lifted style at the hold mark.
- [ ] A sent capture lands with the rise and fade.
- [ ] The source menu scales in from its chip.
- [ ] Reduce motion turns every one of these into an instant change.
- [ ] No animation runs on a scroll or a tap that does not change state.

## Outcome

(filled in before moving to done/)
