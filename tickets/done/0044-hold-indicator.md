---
id: 0044
title: A hold shows when a task is ready to drag
created: 2026-10-25
priority: normal
assignee: omp
pr: 63
depends: []
---

## Spec

On the phone, a task row or pill becomes draggable after a short hold.
Until the finger moves, nothing says the hold is running or that the
drag is armed. The only feedback arrives once the drag has started.

Two cues: a quiet tint from the moment the finger lands, and the lift
(scale and shadow, the style a picked row already uses) when the hold
reaches its threshold. Releasing early clears both.

The web path gets the same timing, so the preview shows it.

## Acceptance

- [ ] A row tints while the finger is down.
- [ ] At the hold threshold, before any movement, the row lifts.
- [ ] Releasing before the threshold clears the tint and the lift.
- [ ] The pill form uses the shorter hold and the same cues.
- [ ] Moving before the threshold still scrolls; nothing lifts.

## Outcome

A touch down on a row or pill starts a hold cue at once: the row takes
the accentSoft tint. When the hold reaches its threshold (300ms for a
row, 120ms for a pill), the row lifts: the same scale and shadow a
picked row already uses. Releasing early, or moving enough to scroll,
clears both.

Native had no hold phase: the gesture only reported at activation, so
the first cue arrived with the drag. The pan now reports on touch down
and on finalize, and the screen runs the clock. The web path runs the
same clock, so the preview shows what the phone shows.

The week and month sections share the cue through the planner's
gesture hook.

Verified in the web preview at 390 by 800: a row shows the tint at
120ms and the lift at 500ms, a pill lifts at 170ms, and releasing
restores the row's surface and no transform. 240 tests, tsc clean,
eslint 0 errors.
