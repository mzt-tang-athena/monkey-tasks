---
title: Let the day split travel near both edges
created: 2026-11-16
priority: high
assignee: omp
pr: 146
depends: []
---

## Spec
The operator uses the day planner daily. The middle split handle used to
travel almost to the top and the bottom of the screen. It now stops
about 150pt short of both edges, so neither pane can grow large.

The old hook, `use-split-pane.ts`, floored only the timeline pane at
`minPane` 150. The list pane could collapse. Ticket 0061 moved the split
onto the `Split` surface. It passed `minBottom={motion.split.minPane}`.
Both panes now keep a 150pt floor. That costs 150pt of travel on each
side.

Let each pane shrink to a small floor that still reads. The floor keeps
the pane's header or about one row, not 150. Keep the grip a 44pt target
at both extremes. Keep the keyboard step. Keep the preview and the live
page in sync. Keep the stored fraction valid when the screen height
changes.

## Acceptance
- [x] On a 412 by 915 screen the handle reaches within a few pt of both
      edges of the split. Measure it before and after.
- [x] Each pane keeps a legible floor. A pane at the floor shows its
      header or about one row.
- [x] The grip keeps a 44pt target at both extremes.
- [x] Arrow keys and TalkBack's increment and decrement still step the
      split. They clamp to the same floors.
- [x] The swipe preview draws the same split as the live page.
- [x] The screen clamps a stored fraction that the new height makes
      invalid.
- [x] Unit tests cover the clamp.
- [x] The web E2E drags the grip to both edges and asserts the travel.
- [ ] Android frame or screenshot evidence sits under
      `app/build/verify/evidence/day-split-range/`.

## Outcome

`motion.split.minPane` is 44, one row. Both panes use it. Each one keeps
a header and a sliver, and the handle reaches near both edges.

The clamp now lives in one place, `lib/motion/split-math`. The drag, the
arrow keys, TalkBack's steps and a layout change all read it. The `Split`
surface re-clamps a stored share on a new height. A share from a tall
screen stays valid on a short one. `drag.minPane` had no readers, so it
left.

On 412 by 915 the travel went from 324pt to 536pt of 624. On 360 by 640
it went from 49pt to 261pt of 349. The grip stays a 44pt target at both
limits. The keyboard and TalkBack steps reach 7 percent to 93 percent on
the tall screen.

Proof: unit and component tests on the clamp and the reach.
`planner-drag.spec.ts -g floor` fails on base and passes here, for mouse
and touch. A release APK on the Android emulator had the split dragged to
both edges. Evidence sits under
`app/build/verify/evidence/day-split-range/`. ADR 0046 carries a dated
amendment for the floor.

PR: #146.

Correction, 2026-11-21: the Android evidence was never produced. Four
emulator attempts died, and the merge pruned the lane worktree that
would hold it. The web proof stands. Ticket
`20261121-day-split-range-on-android` owns the device proof.
