---
title: Week and month lists take the day's divider
created: 2026-11-18
priority: high
assignee: omp
pr: 174
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

Fixed on 2026-11-18 on `fix/week-month-divider`.

`split.tsx` gains `SplitFit`.
The top pane keeps the height its card gives it.
The divider draws the day's dashed rule and grip.
The list below fills the rest and clips at its top edge. The divider's
markup moved into one `Divider` in the same file, so `Split`,
`SplitStill` and `SplitFit` draw the same band.

Week and Month do not resize. Both cards have an intrinsic height, so
a drag could only clip the card or leave paper under it. The grip is
the day's mark and carries no slider role. ADR 0046 records the
choice.

The audit found these other edges, with a shot at 412 wide in each
palette:

- Lists, list under the tab strip: a scrolled card ends flush
  under the strip, no rule.
- Planner day, timeline under the TIMELINE label: hour rows scroll
  under the label, no rule.
- Journal, entries under the month band: the band and the page meet
  with no rule.
- Inbox, cards under the title: cards would scroll under the title
  with no rule.
- Settings, sections under the Back row: no band and no rule.
- The bottom bar has a shadow, so it reads as an edge.
- The command pane fits its rows today, so nothing scrolls in it.
- The editor and capture sheets have their own top edge.

Evidence: `app/build/verify/evidence/20261118-144555/` for the rest,
`20261118-145035/` for the deeper scrolls, and `20261118-151636/` for
the fixed week and month.

Gate: tsc, eslint, 1187 vitest tests, the full web suite, record
names, changelog, and Vale on the ADR.
