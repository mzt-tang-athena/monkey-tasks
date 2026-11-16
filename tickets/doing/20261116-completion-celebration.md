---
title: Completion celebration
created: 2026-11-16
priority: high
assignee: omp
pr:
depends: []
---

## Spec

Ticking a task should feel satisfying. Today the circle pops, a wash
crosses the row, and the row moves to Completed. The operator wants the
light confirmation Todoist and Google Tasks give on a tick. That is a
short burst of particles from the checkbox.

The burst starts at the checkbox the user tapped. It runs on the UI
thread with Reanimated, over about 400 to 700 ms. It draws in the
active palette's accent and its neighbours. It must not move the row,
block the next tap, or delay the tick and the row's leave.

It plays only on a user's tick. An undo, a sync or a reload plays
nothing. Reduced motion draws no particles. The still tick that exists
today is enough there.

The burst must outlive the row. ADR 0034 holds a ticked row for the
tick's 320 ms. The row then moves to Completed as a new element. An
effect drawn inside the row would stop at 320 ms. The burst draws above
the list instead, anchored to the checkbox's place on screen.

Cost is the constraint. Add no dependency and no timer. Do no JS work
per frame. Mount nothing on the row's path unless the user ticks.

## Acceptance

- [ ] A tick from the checkbox plays one burst from that checkbox.
- [ ] The burst lasts about 400 to 700 ms, then removes itself.
- [ ] The burst draws above the list and below the bottom bar, and lets
      every press through.
- [ ] The tick and the row's leave keep their current timing.
- [ ] A user tick plays. An undo, a sync or a reload does not.
- [ ] Reduced motion mounts no burst.
- [ ] A component test covers the trigger rule.
- [ ] An e2e check proves the burst mounts and unmounts on the web build.
- [ ] Evidence sits under `app/build/verify/evidence/completion-celebration/`.
- [ ] An ADR records the look, the cost, and what we rejected.

## Outcome

(filled in before moving to done/)
