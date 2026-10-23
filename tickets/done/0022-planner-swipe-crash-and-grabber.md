---
id: 0022
title: Planner swipes crash and the grabber does not resize
created: 2026-10-22
priority: high
assignee: omp
pr: 19
depends: [0021]
---

## Spec

Two reports from the phone, both in the planner:

1. Swiping left or right in the day planner and in the month planner
   closes the app.
2. Holding the timeline grabber does nothing. The split never resizes.

Both come from the same mistake: a mechanism that the device does not
run.

- The swipe read `onTouchStart`, `onTouchMove`, and `onTouchEnd` on the
  parent of a scroller. The props exist, but this path crashes on the
  device.
- The grabber was a `Pressable` inside a gesture detector. A `Pressable`
  takes the responder, so the native pan that resizes never saw the
  drag. Its `onPointerDown` never fired on Android either.

Fix the swipe to read the responder system through `PanResponder`, with
the capture phase taking the touch from the scroller on horizontal
travel only. Make the grabber a plain `View`: the pan resizes on native,
the pointer path keeps the web behaviour.

Add a global error handler. A release build closes on the first
uncaught error, so a crash reports nothing. The handler shows the
message and the first frames of the stack.

## Acceptance

- [ ] A swipe in the day planner moves one day and does not close the app.
- [ ] A swipe in the month planner moves one month and does not close the app.
- [ ] A vertical scroll changes neither the day nor the month.
- [ ] Dragging the grabber resizes the split on the phone.
- [ ] An uncaught error shows a dialog with the message, not a closed app.

## Outcome

`babel-preset-expo` auto-adds `react-native-worklets/plugin`, which
workletized the gesture callbacks. They ran on the UI runtime and threw
`Tried to synchronously call a Remote Function`. Every gesture that
touches state now calls `.runOnJS(true)` (ADR 0019). The grabber owns
its pan and resizes the split.

Verified: day and month swipes do not crash. The grabber resizes on the
phone.
