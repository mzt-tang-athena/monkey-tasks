---
id: 0066
title: Monthly tasks on the 29th to 31st skip the short months
created: 2026-10-27
priority: high
assignee: claude-code
pr: 84
depends: [0050, 0052]
---

## Spec

A monthly task due on the 31st skips every month with fewer days.
Capture writes a bare `FREQ=MONTHLY` or `FREQ=MONTHLY;INTERVAL=2`
(`features/capture/parse.ts`, lines 29, 70 and 74). The rule starts on
the task's due date (`buildRule` in `features/tasks/recurrence.ts`,
which 0050 moves to `lib/recurrence.ts`). rrule follows RFC 5545, so
it skips a month that has no such day:

| Rule | Start | Next three |
|---|---|---|
| `FREQ=MONTHLY` | 2027-01-31 | 2027-03-31, 2027-05-31, 2027-07-31 |
| `FREQ=MONTHLY;BYMONTHDAY=-1` | 2027-01-31 | 2027-02-28, 2027-03-31, 2027-04-30 |
| `FREQ=MONTHLY;INTERVAL=2` | 2026-12-31 | 2027-08-31, 2027-10-31, 2027-12-31 |

A task due on the 30th skips February every year. A task due on the
29th skips February in a common year. A yearly task due on 29
February comes back only in a leap year. Each tick creates the next
note from the rule (ADR 0027). As a result, the gap comes back for the
life of the task. The user sees no error. The task is missing for a month.

The Obsidian Tasks plugin warns about the same trap, and it
recommends "every month on the last"
([Recurring Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks/blob/f9e3a5a311d8922e71fe1b7af1a6d50ff10782b5/docs/Getting%20Started/Recurring%20Tasks.md)).

### The fix

A month-end task lands on the last day of each short month. Then it
goes back to its own day. Write this into the rule. That way the rule
does not depend on the start date. Every reader of the note then gets
the same dates. We checked each rule below against rrule on 2026-10-27:

| Due date | Rule | Dates |
|---|---|---|
| Day 1 to 28 | `FREQ=MONTHLY` (no change) | |
| 2027-01-29 | `FREQ=MONTHLY;BYMONTHDAY=28,29;BYSETPOS=-1` | 2027-01-29, 2027-02-28, 2027-03-29 |
| 2027-01-30 | `FREQ=MONTHLY;BYMONTHDAY=28,29,30;BYSETPOS=-1` | 2027-01-30, 2027-02-28, 2027-03-30 |
| 2027-01-31 | `FREQ=MONTHLY;BYMONTHDAY=-1` | 2027-01-31, 2027-02-28, 2027-03-31, 2027-04-30 |
| 2026-12-30, every other month | `FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=28,29,30;BYSETPOS=-1` | 2026-12-30, 2027-02-28, 2027-04-30 |
| 2028-02-29, yearly | `FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1` | 2028-02-29, 2029-02-28 |

A rule keeps its `INTERVAL`.

- Capture writes the rule from the due day.
- A change of due date in the editor writes the rule again for the
  new day.
- The next occurrence keeps the rule text.
- A note in the vault can already hold a bare `FREQ=MONTHLY` with a
  due day after the 28th. Decide whether the app reads it as the
  rule above, or writes the rule above on the next save. Record the
  choice in an ADR.

The contracts schema accepts any `KEY=value` rule, so it needs no
change.

### Tests first

Each case gets a failing test before its fix:

- A capture of "pay rent every month" due 31 January 2027 runs
  through three ticks. It gives due dates 31 January, 28 February,
  31 March and 30 April.
- The same for the 30th and the 29th, through February in a leap year
  and in a common year.
- A capture of "pay rent every other month" due 31 December 2026
  gives 28 February 2027 next.
- A yearly task due 29 February 2028 comes back on 28 February 2029.
- A monthly task due on the 15th keeps `FREQ=MONTHLY`.

## Acceptance

- [x] Each case above had a failing test before its fix, and all
      pass.
- [x] A monthly task due after the 28th has a due date in every month.
- [x] An ADR records the rule format and how the app treats a bare
      `FREQ=MONTHLY` note due after the 28th.
- [x] `npm run vault:check` reports nothing new for the new rules.
- [x] In the browser, three ticks of a month-end sample task show the
      dates in the table under "The fix". (A Playwright spec ticks a
      31 January 2026 task three times: 28 February, 31 March and
      30 April. The unit and store tests cover the table's 2027
      rows, because a future next date has no row to tick.)

## Outcome

Month-end rules landed (ADR 0042).

- `monthEndRule` in `app/src/lib/recurrence.ts` makes the rule from the
  bare rule and the due day. Capture, the editor save, the tick and the
  reader call it. A bare `FREQ=MONTHLY` note due after the 28th reads
  as the month-end rule. The app writes the explicit rule at the
  next tick or editor save. It never rewrites a note on load.
- Tests came first and failed before the fix. The set held unit tests
  for the rule and the tick chain, plus capture and editor tests. It
  also held store tests that capture a line and tick it through the
  short months, and a Playwright spec. The 29 January 2028 case passed before the fix,
  because 2028 is a leap year. It stays as a guard.
- `npm run vault:check` reports 0 findings for the four new rule forms.

Findings from earlier reviews, assigned to this ticket:

1. The "keeps the recurring sample valid after a no-op edit" test now
   asserts `FREQ=DAILY`. It checks both the sample and the row. It fails when
   the sample goes back to `RRULE:FREQ=DAILY`.
2. A `SuccessorKeptError` now schedules the kept note's alarm. The
   mutation spec has an `errorAlarms` hook for it.
3. A Retry that runs behind a tap that fails left the row open while
   the note was complete. `settle` now gets a `last` flag. When no other
   vault write is pending, the toggle lands the note's state on the
   row. A store test covers it.
4. The 0052 sentence now says the Playwright test covers only the
   stale tick.

Left over: nothing. The planner still paints only what `rrule` returns
for the rule, so a month grid shows the month-end dates.
