---
id: 0021
title: Swipes read touch events, not pointer events
created: 2026-10-22
priority: high
assignee: omp
pr: 18
depends: []
---

## Spec

The list tab, the day planner, and the month planner all had a
left/right swipe on the desktop preview and none on the phone.

Two causes:

- `lib/swipe.ts` read `onPointerDown`, `onPointerMove`, and `onPointerUp`.
  React Native does not deliver pointer events to a View, so the tripwire
  never armed on a device. The month planner used only this path, so its
  swipe could not work at all.
- The list tab and the day planner used `Gesture.Pan()` on the parent of a
  scrolling list or pane. On Android the scroller takes the touch stream,
  so the parent pan never sees the moves.

Fix: one tripwire, fed by touch events on native and pointer events on
web. Touch events bubble to the parent while a child scroller scrolls, so
the swipe works over a list. A drag that starts after the down claims the
gesture, so a sideways drag does not also shift the day.

## Acceptance

- [ ] Swiping the list body switches Focus and Main.
- [ ] Swiping the day planner moves one day back or forward.
- [ ] Swiping the month grid moves one month back or forward.
- [ ] A vertical scroll never changes the tab, the day, or the month.
- [ ] A task drag or a grabber resize never fires a swipe.

## Outcome

`lib/swipe.ts` uses `PanResponder` on native and pointer events on web.
A capture-phase gate lets a drag or the grabber claim the gesture before
the swipe sees it. The horizontal threshold and the diagonal rejection
are unit tested.

Verified: list, day, and month swipes work on the phone. Scrolling never
changes the page.
