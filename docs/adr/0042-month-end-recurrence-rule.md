# 0042. Month-end tasks use an explicit rule

- **Status:** accepted
- **Date:** 2026-11-04

## Context

A monthly task due on the 31st needs a note in every month. A bare
`FREQ=MONTHLY` follows RFC 5545. The rule skips a month that has no 31st.
A task on the 30th skips February. A yearly task on 29 February skips
every common year. The user sees no error. The task is missing for a
month (ticket 0066).

A vault can already hold a bare `FREQ=MONTHLY` note with a due day after
the 28th. The app must decide what it does with that note.

## Decision

A month-end task lands on the last day of a short month. It goes back to
its own day after that. The rule says so, so it does not depend on the
start date:

| Due day | Rule |
|---|---|
| 1 to 28 | `FREQ=MONTHLY` |
| 29 | `FREQ=MONTHLY;BYMONTHDAY=28,29;BYSETPOS=-1` |
| 30 | `FREQ=MONTHLY;BYMONTHDAY=28,29,30;BYSETPOS=-1` |
| 31 | `FREQ=MONTHLY;BYMONTHDAY=-1` |
| 29 February, yearly | `FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1` |

A rule keeps its `INTERVAL`. It sits after `FREQ`.

`monthEndRule` in `app/src/lib/recurrence.ts` makes the rule. The app
calls it in four places:

- Capture writes the rule for the due day.
- The editor writes the rule again when the due day changes. A new time
  on the same day keeps the rule.
- A tick copies the rule to the next note. The next note keeps the text,
  so its own ticks keep the anchor.
- The reader applies it to a bare rule before it expands the rule.

We chose to read and write. A bare `FREQ=MONTHLY` note due after the 28th
reads as the month-end rule. The app writes the explicit rule into the
next note at a tick. It also writes it into the note at the next editor
save. The app
does not rewrite a note on load. The user's files stay as they are until
the user acts on them.

We rejected "write only". Such a note would show the gap in the planner
until its first tick.

We rejected "read only". The next note would carry the bare rule with a
due day of 28 February. That rule means the 28th, so the series would
drift to the 28th for good.

The function changes only the bare forms and the forms it wrote. A rule
with `COUNT`, `BYDAY` or a user `BYMONTHDAY` stays unchanged.

## Consequences

A monthly task on the 29th to 31st has a due date in every month.

Take a reader that does not know this ADR, such as Obsidian Tasks. It
sees a valid RRULE and gets the same dates.

A bare `FREQ=MONTHLY` note due on the 28th or earlier stays bare. A bare
rule on a note due on 28 February is ambiguous. It cannot tell a
month-end series from a series on the 28th. The app reads it as the 28th.

The editor shows the explicit rule text after a save. The recurrence
field is free text, and a longer rule is harder to read there.
