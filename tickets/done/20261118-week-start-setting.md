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

Shipped on 2026-11-18 on `feat/week-start-setting`, PR 177.

`Settings` gains `weekStart`, `"monday"` or `"sunday"`, in the app's
settings file. Monday is the default, and a saved settings file with
no key gets it too.

`startOfWeek(date, weekStart)` takes the setting as a required
argument, so no caller can fall back silently. One helper in
`utils/dates` gives the day's place in the week and the weekday
names in the week's order. The week grid, the week strip, the month
grid, the Due picker and the source label all read it.

Recurrence keeps its meaning: iCalendar rules use Monday, and
`lib/recurrence.ts` never reads the setting. ISO week numbers stay
Monday-based under both settings.

Unit tests cover both settings across a month edge (1 November
2026) and a year edge (1 January 2027).
They cover the week name across a month and a year, and `monthRows`
for both orders.

The e2e flips the setting in Settings.
It reads the week boxes in grid order, the week strip's range and
the month grid's header.
Then it reloads.

Gate: tsc, eslint, 1195 vitest tests, 620 e2e passed and 26 skipped,
record names, changelog, and Vale on the ADR.

Evidence: `app/build/verify/evidence/20261118-172508/` holds the
Settings control, the week grid and the month grid, Monday first.
