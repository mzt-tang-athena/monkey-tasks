# 0018. Swipes read touch events

- **Status:** accepted
- **Date:** 2026-10-22

## Context

The list tabs, the day planner, and the month planner each have a
left/right swipe. All three worked in the desktop preview and none worked
on the phone.

The month planner read `onPointerDown`, `onPointerMove`, and `onPointerUp`.
React Native has no pointer events, so those props did nothing on Android.
The list tab and the day planner used a `Gesture.Pan()` on the parent of a
scrolling list or pane. On Android the scroller owns the touch stream, so
the parent pan never received the moves.

## Decision

One swipe tripwire, fed by the platform's native events:

- web: pointer events, which the browser already sends
- Android and iOS: touch events, `onTouchStart`, `onTouchMove`,
  `onTouchEnd`

Touch events bubble to a parent while a child scroller scrolls, so a
swipe over a list reaches the tripwire. The tripwire arms only on travel
of 80 points or more that is 1.6 times more horizontal than vertical, so
a scroll never changes the page. A drag or a resize calls `claim()` when
it starts, which disables the tripwire for the rest of that gesture.

## Consequences

The swipe works over a scrolling list without a pager component and
without changing the scrollers. The tripwire runs on the JS thread, which
is the same thread the browser path already used.

The gesture handler library is still the right tool for drags and the
split resize. Those start on a single element and are long presses, not
travel over a scroller.

## Alternatives

**`Gesture.Pan()` with `simultaneousWithExternalGesture`.** It needs the
scroller to be a gesture-handler component, so every list and pane would
change. It also leaves the swipe competing with the drag gestures in the
same tree.

**A pager component.** `react-native-pager-view` would give native page
transitions, but the list is one FlatList, not pages, and the planner
panes are not pages either.

## Amendment 2026-10-22: the responder system, not touch props

The first version read `onTouchStart`, `onTouchMove`, and `onTouchEnd`.
On the device the day and month swipes crashed the app. The touch props
are part of the View contract but not a path this app should lean on
over a scroller.

We now use `PanResponder`. It is the same tripwire, fed by the responder
system instead of raw touch props. The capture phase is what takes the
touch away from the scroller: `onMoveShouldSetPanResponderCapture`
returns true only for travel that is 12 points long and 1.6 times more
horizontal than vertical. The start point is recorded in
`onStartShouldSetPanResponderCapture`, which returns false so the touch
keeps flowing until the swipe is clear.

The grabber changed with it. It was a `Pressable` with pointer handlers
inside a gesture detector. A `Pressable` takes the responder, so the
native pan never saw the drag, and the pointer handlers never fired on
Android. It is a plain `View` now: the pan resizes, the pointer path
reserves the same gesture on web.

The root layout installs a global error handler. A release build closes
on the first uncaught error, and a closed app reports nothing. The
handler shows the message and the first frames of the stack instead.
