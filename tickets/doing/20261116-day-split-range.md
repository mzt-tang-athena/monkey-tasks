---
title: Let the day split travel near both edges
created: 2026-11-16
priority: high
assignee: omp
pr:
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
- [ ] On a 412 by 915 screen the handle reaches within a few pt of both
      edges of the split. Measure it before and after.
- [ ] Each pane keeps a legible floor. A pane at the floor shows its
      header or about one row.
- [ ] The grip keeps a 44pt target at both extremes.
- [ ] Arrow keys and TalkBack's increment and decrement still step the
      split. They clamp to the same floors.
- [ ] The swipe preview draws the same split as the live page.
- [ ] The screen clamps a stored fraction that the new height makes
      invalid.
- [ ] Unit tests cover the clamp.
- [ ] The web E2E drags the grip to both edges and asserts the travel.
- [ ] Android frame or screenshot evidence sits under
      `app/build/verify/evidence/day-split-range/`.

## Outcome
