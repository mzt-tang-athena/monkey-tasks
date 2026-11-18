---
title: Week and month lists take the day's divider
created: 2026-11-18
priority: high
assignee: omp
pr:
depends: []
---

## Spec

The operator scrolls the list under the week and month cards on the
phone. The rows slide into the card with no edge. Day already has a
divider and a grip between its timeline and its list.

Give Week and Month the same divider, from the same split file. The
list then clips at a clear edge instead of running into the card.

Week and Month do not resize.
Their top pane is a card with an intrinsic height.
A drag could only clip the card or leave paper under it. The day's top pane is a timeline that scrolls, so its drag
moves a real edge. The grip on Week and Month is the day's mark and
carries no drag.

Audit the other screens for a scrolling area that runs into another
surface with no edge.
Do it in a light and a dark palette. Report each spot
with a screenshot at 412 wide. Do not fix them here.

## Acceptance

- [ ] Week and Month draw the day's divider between the card and the
      list, and the list clips at it.
- [ ] The week still fits one screen in both layouts.
- [ ] The grip on Week and Month carries no slider role.
- [ ] An e2e test reads the card, the grip and the list in both modes.
- [ ] The audit lists every other edge with no border and its shot.
- [ ] tsc, eslint, vitest, the records check, the changelog check, Vale
      and the full web suite pass.
- [ ] `CHANGELOG.md` lists the change under 1.2.0.

## Outcome
