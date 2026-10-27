---
id: 0066
title: Monthly tasks on the 29th to 31st skip the short months
created: 2026-10-27
priority: high
assignee:
pr:
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
note from the rule (ADR 0027), so the gap comes back for the life of
the task. The user sees no error. The task is
missing for a month.

The Obsidian Tasks plugin warns about the same trap, and it
recommends "every month on the last"
([Recurring Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks/blob/f9e3a5a311d8922e71fe1b7af1a6d50ff10782b5/docs/Getting%20Started/Recurring%20Tasks.md)).

### The fix

A month-end task lands on the last day of each short month. Then it
goes back to its own day. Write this into the rule, so the rule does
not depend on the start date, and every reader of the note gets the
same dates. We checked each rule below against rrule on 2026-10-27:

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

- A capture of "pay rent every month" due 31 January 2027 gives due
  dates 31 January, 28 February, 31 March and 30 April over three
  ticks.
- The same for the 30th and the 29th, through February in a leap year
  and in a common year.
- A capture of "pay rent every other month" due 31 December 2026
  gives 28 February 2027 next.
- A yearly task due 29 February 2028 comes back on 28 February 2029.
- A monthly task due on the 15th keeps `FREQ=MONTHLY`.

## Acceptance

- [ ] Each case above had a failing test before its fix, and all
      pass.
- [ ] A month-end task has a due date in every month.
- [ ] An ADR records the rule format and how the app treats a bare
      `FREQ=MONTHLY` note due after the 28th.
- [ ] `npm run vault:check` reports nothing new for the new rules.
- [ ] In the browser, three ticks of a month-end sample task show the
      dates in the table.

## Outcome

(filled in before moving to done/)
