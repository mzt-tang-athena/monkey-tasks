---
id: 0031
title: The source chip jumps two lists
created: 2026-10-23
priority: high
assignee: omp
pr:
depends: [0025]
---

## Spec

On the phone, tapping the source chip above the planner's bottom list
sometimes lands two sources ahead: a tap on Due today shows Main
instead of Focus. It reads as a double tap.

The state advances once. The chip previews the next source while
pressed, and Android delivers `onPress` before the delayed
`onPressOut` (Pressability's 130 ms minimum press duration). The tap
moves the source, the chip re-renders still pressed, and the preview
now shows the source after the one the tap chose.

End the pressed visual when the action lands, before the cycle.

## Acceptance

- [ ] A tap advances exactly one source, even when it is shorter than
      the press-out delay.
- [ ] The chip never shows the source after the chosen one.
- [ ] A hold still opens the menu and does not cycle.

## Outcome

(filled in before moving to done/)
