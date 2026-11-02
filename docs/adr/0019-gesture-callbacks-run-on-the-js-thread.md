# 0019. Gesture callbacks run on the JS thread

- **Status:** superseded by 0036
- **Date:** 2026-10-22

## Context

Every drag on the phone crashed. `babel-preset-expo` adds
`react-native-worklets/plugin` because `react-native-worklets` is
installed. The plugin workletizes callbacks passed to
`Gesture.Pan().onStart` and its siblings, so they run on the UI runtime.

The drag callbacks call `api.pickup`, `api.move`, `api.drop`, and React
setters. Those are plain JS functions. On the UI runtime they are remote
guards that throw on call. The drag therefore threw before it started,
and the grabber threw on its first statement.

## Decision

Every gesture that touches app state calls `.runOnJS(true)`. Its
callbacks then run on the JS thread like ordinary functions.

The drag needs measurement, hit testing, React state, and a store write.
None of that can run on the UI runtime without a second hop per event.
Keeping the work on the JS thread is simpler and matches what the
callbacks already do.

## Consequences

Drags are responsive enough for this app: one move event updates a ghost
and hit-tests a list of rects. A future drag that needs 60 fps visuals
would move the ghost to a shared value and leave the hit test on the JS
thread.

The worklets plugin still marks these callbacks. That is harmless,
because `runOnJS(true)` forces the JS path.

## Alternatives

**Move every callback body behind `runOnJS` or `scheduleOnRN`.** Same
result with more moving parts, and the state writes would still be
asynchronous hops.

**Keep the worklets and make the drag UI-thread native.** It needs the
drop zones in shared values and the store write behind a JS hop. That is
a rewrite of the drag, and the drag is not the bottleneck.

## Amendment, 2026-10-26: superseded by 0036

Gesture callbacks now run as worklets on the UI thread (ADR 0036).
They reach app code only through `scheduleOnRN`, at a pickup, a drop
or a page commit. Only the primitives in `src/lib/motion` make that
call. The crash this ADR fixed comes back if a feature worklet calls
app code directly, and the primitives exist to prevent it.

The consequence above held for the logic and failed for the visuals.
The ghost, the row slides and the pager lagged whenever the JS thread
rendered a page or wrote a note.
