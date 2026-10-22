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
