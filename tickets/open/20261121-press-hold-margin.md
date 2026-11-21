---
title: The short-press test needs more margin than 150 ms
created: 2026-11-21
priority: normal
assignee:
pr:
depends: []
---

## Spec

`motion-surfaces.spec.ts:23`, "a press shorter than the hold lifts
nothing", failed once in a full gate on 2026-11-20 under load. A 100 ms
press lifted and dropped the chip.

`holdDrag` runs 150 ms of fake clock, then moves the mouse on the real
clock. The hold fires at 300 ms, so one long pause in the app eats the
150 ms of margin. Alone, it passed 10 of 10 at load 13. Ticket 0070
fixed two flakes of the same class.

- Make the press end before any real-clock step can reach the hold.
  Release on the fake clock, or move with the clock paused.
- Keep the 300 ms hold and the 100 ms press. Raise no timeout.

## Acceptance

- [ ] The press releases before the hold can fire, by construction.
- [ ] Twenty runs under a loaded host all pass.
- [ ] The held-drag test beside it still passes.

## Outcome

(filled in before moving to done/)
