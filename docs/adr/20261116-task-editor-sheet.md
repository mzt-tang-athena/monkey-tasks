# The task editor is a sheet, with instant save and an Undo

- **Status:** accepted
- **Date:** 2026-11-16

## Context

The task editor was a full-screen route with six text fields. It asked
for ISO dates, an RRULE string and a newline list of names. It had one
Save button. A failed save kept the user on the screen.

The operator named Todoist's task sheet as the reference. They asked
for a bottom sheet with pickers, and a write on each change. They also
asked for no raw syntax on the main path (ticket 0093).

A task has one note file. A rename writes a new file under SAF. Writes
can fail, and another app can change the file between a read and a
write (ADR 0017, ADR 0037).

## Decision

The editor is a bottom sheet over the screen that shows the task. The
sheet holds the list picker and the title. A property with a value
shows as a tile. One without shows as a chip in the add strip. A
picker is a second sheet stacked over it.

Each committed change writes at once through the edit mutation. The
session lives in a provider above the stack, with one write in flight
per task. A change made while a write runs waits. Only the latest
draft goes next. A failure keeps the draft on screen and shows "Not
saved." with Retry. Retry writes the draft against the latest text the
store holds. The title writes on blur, on submit and on close, because
a rename writes a new file.

Delete removes the note and shows a toast with Undo for five seconds.
Undo writes the exact text the file held back to the same path.

We rejected the route. It hides the list behind it, and it cannot hold
a stacked picker without a second route.

We rejected a Save button. Every change is small, and a Save button
loses the change when the app closes.

We rejected a write per keystroke. A rename writes a new file under
SAF, so the title writes only when the user leaves the field.

We rejected a trash folder. The vault has no trash, and a folder adds
a second place a task can live. The toast holds the text for five
seconds, and after that the delete is permanent.

## Consequences

The sheet keeps the list visible, and a change costs one tap. The
editor never shows an ISO date or an RRULE string in the main path.
Recurrence keeps one advanced field, and it previews the next three
dates in plain words.

A write can fail after the sheet closes. The sheet shows the failed row
when it opens again. A delete waits for the write in flight, so a
rename cannot leave a stale file.

The session reducer and its queue are pure and tested. Reference
(ticket 0091) and alert weight join the property registry as one more
entry each.
