---
title: Week starts on Monday, as a setting
created: 2026-11-18
priority: high
assignee: omp
pr: 177
depends: []
---

## Spec

The operator's week planner runs Sunday to Saturday. The month grid,
the week strip and the Due picker's month grid do the same.

Add a "Week starts on" setting with Monday and Sunday. Monday is the
default, for a fresh install and for one that already has settings.

Every week-ordered surface follows it:

- `startOfWeek` in `features/planner/model.ts`, and its callers.
- The week grid's boxes and the week strip.
- The month grid's header and its first row.
- The Due picker's month grid.
- The week name in the source toggle and the chooser.

Recurrence keeps its meaning. `lib/recurrence.ts` writes and reads
iCalendar rules, whose week starts on Monday by definition. Only
display order and week bounds move.

Week numbers stay ISO and Monday-based, under both settings.

## Acceptance

- [ ] Settings has a "Week starts on" control with Monday and Sunday,
      and Monday is the default.
- [ ] The week grid, the week strip, the month grid and the Due
      picker follow it.
- [ ] A unit test covers both settings across a month edge and a year
      edge.
- [ ] An e2e flips the setting and checks the week grid, the strip and
      the month header.
- [ ] Recurrence rules produce the same dates under both settings.
- [ ] tsc, eslint, vitest, the records check, the changelog check, Vale
      and the full web suite pass.
- [ ] `CHANGELOG.md` lists the setting under 1.2.0.
- [ ] An ADR records the default and the vault decision.

## Outcome
