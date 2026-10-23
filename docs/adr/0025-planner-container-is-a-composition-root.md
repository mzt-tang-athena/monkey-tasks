# 0025. The planner container is a composition root

- **Status:** accepted
- **Date:** 2026-10-23

## Context

Ticket 0024 split the planner's components out of the route and left
`PlannerScreen` at 632 lines. It held the route state, the store reads,
the drag state, the swipe guards, the month model, two state panes and
the JSX.

The drag and swipe code is one unit, not two. A drop arms a click
suppression that the swipe guards read, and both hit-test the same drop
zone registry. Splitting them by name would move a shared ref across a
module boundary.

## Decision

The container keeps data and layout only:

- `usePlannerGestures` owns the drag and swipe machinery.
- `usePlannerMonth` owns the month model and the picked day.
- `PlannerStates` owns the loading and error panes.
- `PlannerScreen` reads the route and the store, holds the source and
  form state, and renders.

The move is mechanical. Hook order, ref writes and effect order stay as
they were, because the touch paths were verified on a device and a
reordered effect is a regression that tests do not catch.

## Consequences

The container reads as a composition root. A change to drag behaviour
has one home. The gesture hook is still large, and that is deliberate:
it is cohesive, and a further split would separate a ref from the code
that writes it.

## Alternatives

**Split the drag and the swipe into separate hooks.** The suppression
ref and the drop zone registry are shared, so the boundary would need a
third module to hold them, which is more indirection for less clarity.
