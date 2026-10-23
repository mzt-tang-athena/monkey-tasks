---
id: 0023
title: Drag tasks on touch
created: 2026-10-22
priority: high
assignee: omp
pr: 20
depends: [0017]
---

## Spec

Dragging a task onto a day or onto the timeline worked in the browser and
crashed on the phone. The cause is confirmed from the library sources.

`babel-preset-expo` adds `react-native-worklets/plugin` because the
package is installed. That plugin auto-workletizes every callback passed
to `Gesture.Pan().onStart/onUpdate/onEnd/onFinalize`. The callbacks then
run on the UI runtime, where any plain JS function is a remote guard that
throws. Every drag and the grabber resize start with such a call, so they
throw before the drag begins.

Fix and gaps:

- Call `.runOnJS(true)` on both gestures. Their work is JS bound:
  measurement, hit testing, React state, store writes.
- The week foot list and the day list never received the drag `api`, so
  their rows were not drag sources at all on Android. Pass it.
- A drop wrote twice: `onEnd` and `onFinalize` both called `api.drop()`.
  Drop once, and use `onFinalize` only for a cancelled pan.
- The click guard stayed armed for 350 ms after a native drop, but only
  the web pointer path clears it, so the next tap was swallowed. Arm it
  on web only.
- The day drag ghost mixed window coordinates with parent-relative
  layout x and ignored y. Measure the root in page space.
- `DropZoneMap` never unregistered an unmounted view, so paging months
  accumulated stale rects that could catch a drop. Unregister on null.

## Acceptance

- [ ] Holding a task row and dragging it onto a day in week and month moves it.
- [ ] Holding a task row in the day list and dragging it onto an hour sets the time.
- [ ] Dragging a timed chip to another hour keeps its minutes.
- [ ] Dragging the grabber resizes the split.
- [ ] One drop writes the note once.
- [ ] A tap right after a drop lands.
- [ ] The ghost follows the finger on both axes.

## Outcome

Drops write again. Inline zone refs are re-invoked with `null` on every
render, and `DropZoneMap.set(id, null)` deleted the measured rect, so
`hit()` returned null and the handler skipped the write. `set(id, null)`
now unregisters the view and keeps the rect; only `measureAll` at pickup
invalidates rects (ADR 0021).

Verified: holding a row and dropping it on a day or an hour writes the
note once, the ghost follows the finger, and a tap right after a drop
lands.
