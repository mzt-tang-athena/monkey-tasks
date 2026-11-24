---
title: The short-press test needs more margin than 150 ms
created: 2026-11-21
priority: normal
assignee: opencode
pr: 217
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

- [x] The press releases before the hold can fire, by construction.
- [x] Twenty runs under a loaded host all pass.
- [x] The held-drag test beside it still passes.

## Outcome

`holdDrag` resumed the page clock before the mouse moved. The 100 ms
press then had 150 ms of real time to reach the 300 ms hold. One long
pause in the app spent it, and the chip lifted and dropped on A.

The clock now stays stopped through the move and the release. Real time
starts again once the button is up. A stalled runner advances no page
time, so the press always ends first. `holdDragTo` resumes as soon as
the press is over, because a test that reads the drag ghost needs
frames. The hold, the press and every timeout stay as they were.

Proof, on the real spec through the verify skill:

- Old code, one 200 ms stall after the resume: 6 of 6 failed.
- Old code under load, no stall: 2 of 20 runs failed, both
  `Received: "chip dropped on A"`.
- Fix, two 200 ms stalls inside the press: 80 of 80 passed.
- Fix under the same load, both motion projects, both tests: 80 of 80
  passed. The held drag passed every time.
- `scripts/gate.sh full`: 497 passed, 28 skipped.

Log and traces: `~/code/monkey-tasks/worktrees/evidence-press-hold-margin/PROOF.md`.

No ADR. The diff holds no costly-to-reverse file. The refused
alternative, releasing before the move, would stop testing a move with
the button down.
