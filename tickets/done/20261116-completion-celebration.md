---
title: Completion celebration
created: 2026-11-16
priority: high
assignee: omp
pr: 147
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

- [x] A tick from the checkbox plays one burst from that checkbox.
- [x] The burst lasts about 400 to 700 ms, then removes itself.
- [x] The burst draws above the list and below the bottom bar, and lets
      every press through.
- [x] The tick and the row's leave keep their current timing.
- [x] A user tick plays. An undo, a sync or a reload does not.
- [x] Reduced motion mounts no burst.
- [x] A component test covers the trigger rule.
- [x] An e2e check proves the burst mounts and unmounts on the web build.
- [x] Evidence sits under `app/build/verify/evidence/completion-celebration/`.
- [x] An ADR records the look, the cost, and what we rejected.

## Outcome

A tick now draws a 520 ms burst from the checkbox the user pressed. The
look is a ring plus eight dots in the active palette's `accent` and
`accentDeep`. The burst stays after the row moves to Completed, so the
320 ms regroup does not cut it. A page tick draws at
`layers.celebrate`, above the list and under the bottom bar. A tick
inside the editor sheet draws at `layers.celebrateSheet`, over the
sheet. Both take no press.

Every tick control plays it. That is a Lists row, a Planner day or list
row, a Planner timeline chip, and the editor sheet's tick. One hook,
`useTickBurst(done)`, holds the rule.

The press triggers the burst. The data alone never does. An undo, a
sync and a reload play nothing. A press that reopens a done task plays
nothing either. Reduced motion mounts nothing.

Cost per burst: one `measureInWindow` call, two provider renders, nine
animated views and nine worklets on one shared value. No timer, no JS
work per frame, no new dependency.

Component tests cover the trigger, the sheet's tick and reduced
motion. An e2e spec watches the document for the mount in both
projects. It covers a row tick, a sheet tick and a sheet reopen.
Evidence is in `app/build/verify/evidence/completion-celebration/`:
the web preview's frame series, and a release APK's frames on the
emulator.

ADR: `docs/adr/20261116-completion-celebration.md`. PR: #147.
