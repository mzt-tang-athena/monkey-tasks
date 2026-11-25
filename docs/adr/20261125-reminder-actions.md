# 20261125. A reminder offers Done, Later and Tomorrow

- **Status:** accepted
- **Date:** 2026-11-25

## Context

The operator wants a reminder to act without opening the app, as TickTick
and Google Tasks work. The ticket asks for two buttons: mark the task done,
and reschedule it.

Android shows three buttons on a notification at most. It cannot show a
date picker there. The app already has a date sheet on the task, and it
already writes a tick and a due date.

## Decision

A reminder carries Done, Later and Tomorrow. A tap on the notification
itself still opens the task, so the date sheet is one tap away.

- Done writes `completed`, as a tick in the list does, and a repeating task
  makes its next note.
- Later moves the task to an hour from the press, rounded up to the next
  five minutes.
- Tomorrow moves it to nine in the morning, tomorrow.
- Each reschedule writes `due` and replaces `reminders` with the one moment,
  so the reminder rings at the new time.
- A task due on a day, with no time of day, offers Done alone. Rescheduling
  it would give an all-day task a clock time it never had.
- A month-end recurrence rule follows the new due day (ADR 0042).
- A press clears the reminder it answered, and the rest of its group.

We rejected a single Reschedule button that opens the date sheet.
A press there would cost a screen and a wait. The two common moves, an
hour on and tomorrow, would take three taps. A tap on the notification
still reaches the date sheet.

## Consequences

- The two common reschedules cost one tap, with the app closed.
- Later can land on the same minute as an earlier ring of the same group.
  A press clears its own group first, so the task keeps no old ring.
- A task rescheduled past a recurrence's next date still moves the current
  note. The series rules handle the rest on the next tick.
- An all-day task moves only through the date sheet, one more tap.
- Android freezes a reminder's buttons at scheduling time.
  A change to the set needs a reschedule, which a rebuild does.
