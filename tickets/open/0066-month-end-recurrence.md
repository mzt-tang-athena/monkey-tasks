---
id: 0066
title: Monthly tasks on the 29th to 31st skip the short months
created: 2026-10-27
priority: high
assignee:
pr:
depends: [0050]
---

## Spec

A monthly task due on the 31st skips every month with fewer days.
Capture writes a bare `FREQ=MONTHLY` (`features/capture/parse.ts:29`).
The rule starts on the task's due date (`buildRule` in
`features/tasks/recurrence.ts`). rrule follows RFC 5545, so it skips a
month that has no such day:

| Rule | Start | Next three |
|---|---|---|
| `FREQ=MONTHLY` | 2027-01-31 | 03-31, 05-31, 07-31 |
| `FREQ=MONTHLY;BYMONTHDAY=-1` | 2027-01-31 | 02-28, 03-31, 04-30 |

A task due on the 29th or the 30th skips February in the same way. A
yearly task due on 29 February comes back only in a leap year. Each
tick creates the next note from the rule (ADR 0027), so the gap comes
back for the life of the task. The user sees no error. The task is
missing for a month.

The Obsidian Tasks plugin warns about the same trap, and it
recommends "every month on the last"
([Recurring Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks/blob/main/docs/Getting%20Started/Recurring%20Tasks.md)).

### The fix

A month-end task lands on the last day of each short month. Then it
goes back to its own day. Write this into the rule, so the rule does
not depend on the start date, and every reader of the note gets the
same dates. We checked each rule below against rrule on 2026-10-27:

| Due day | Rule | Dates from January 2027 |
|---|---|---|
| 1 to 28 | `FREQ=MONTHLY` (no change) | |
| 29 | `FREQ=MONTHLY;BYMONTHDAY=28,29;BYSETPOS=-1` | 01-29, 02-28, 03-29 |
| 30 | `FREQ=MONTHLY;BYMONTHDAY=28,29,30;BYSETPOS=-1` | 01-30, 02-28, 03-30 |
| 31 | `FREQ=MONTHLY;BYMONTHDAY=-1` | 01-31, 02-28, 03-31, 04-30 |
| 29 February, yearly | `FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1` | 2028-02-29, 2029-02-28 |

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
