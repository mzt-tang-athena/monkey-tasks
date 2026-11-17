# 0025. The planner container is a composition root

- **Status:** accepted
- **Date:** 2026-10-23

## Context

Ticket 0024 split the planner's components out of the route and left
`PlannerScreen` at 632 lines. It held the route state, the store reads,
the drag state and the swipe guards. It also held the month model, two
state panes and the JSX.

The drag and swipe code forms one unit. A drop arms a click
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
they were. The touch paths passed verification on a device. A
reordered effect is a regression that tests do not catch.

## Consequences

The container reads as a composition root. A change to drag behaviour
has one home. The gesture hook is still large on purpose. The hook is
cohesive, and a further split would separate a ref from the code that
writes it.

## Alternatives

**Split the drag and the swipe into separate hooks.** The two hooks
would share the suppression ref and the drop zone registry. The boundary
would need a third module to hold them. That means more indirection for
less clarity.

## Amendment 2026-11-04: one home for drag in all three modes

Ticket 0056 moved the day's drag code out of `DaySpread` and into the
gesture layer. Day mode had its own copy of the hold, the lift, the
ghost, the touch gate and the drop. The two copies had already drifted.
The day's drop armed the click guard on web only, and its pointer path
armed it on every platform.

`hooks/use-drag-session` is now the one home for drag in day, week and
month mode. It owns the pending press, the hold, the lift and the ghost
values. It also owns the touch gate, the click guard and the drop. A
mode gives it a
zone map, and `resolve(hit, task)`, which turns the zone under the finger
into a patch or null. `usePlannerGestures` keeps the day and month
shifts, says what each zone means, and wraps the click guard.

Three choices follow from this move.

- **The ghost has no origin.** The ghost draws through the `OverlayHost`
  at the `dragGhost` layer. That layer fills the window, so the ghost
  uses the pointer's page coordinates. The day root no longer needs to
  measure its own position.
- **The hover lives outside React state.** The session keeps the zone
  under the finger in a small store. Only the panes that draw the hover
  subscribe to it. A move over a new zone renders the timeline, the
  week columns or the month cells. The list pane does not render.
- **The guard is part of the session.** Ticket 0055 plans a shared
  `use-press-guard`. The session keeps its own guard until that lands,
  and one drop path arms it on web only.

The hook order and effect order stay as this ADR asks. The session keeps
the motion on `Animated` values behind its own boundary, so tickets 0059
and 0061 can swap the internals.
