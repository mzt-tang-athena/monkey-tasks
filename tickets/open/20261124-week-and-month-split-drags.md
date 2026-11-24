---
title: The week and month split drags like the day split
created: 2026-11-24
priority: normal
assignee:
pr:
depends: []
---

## Spec

The operator's feedback on 2026-11-24. In Week and Month, the line
between the calendar and the list drags, as it does in Day. Today Day uses a draggable `Split`, while Week and Month use
`SplitFit`, sized to the calendar (`week-pane.tsx`, `month-view.tsx`).

ADR `20261114-week-planner-fits-one-screen` sized the week to fit one
screen with no scroll. A drag that shrinks the top pane needs an answer
for what the calendar does then.

- Propose two or three answers with emulator frames before building.
  The boxes could shrink to a floor. The calendar could collapse to
  the current row. Or the calendar could scroll.
- The operator picks, then build it. Use the day split's grip, floor,
  keys and TalkBack steps (ADR 0046, `split-math.ts`).
- Say whether each view keeps its own split, or all three share one.

## Acceptance

- [ ] The operator picks an answer from frames on the real views.
- [ ] Week and Month drag by touch, mouse, keys and TalkBack steps.
- [ ] The grip and floors match the day split.
- [ ] Web e2e covers both views in both motion projects.
- [ ] Emulator frames show both views at each floor.

## Outcome

(filled in before moving to done/)
