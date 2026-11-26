# A reminder offers Done, Later and Tomorrow

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

## Amendment 2026-11-26: Snooze and Didn't do

The operator asked for a fourth action, "Didn't do". Android shows
three buttons at most (`Notification.MAX_ACTION_BUTTONS` is 3). Expo
SDK 58 adds no way past it, and a fourth button never shows.
Tomorrow left the notification for that reason.

- A reminder now carries Done, Snooze and Didn't do.
- Done and Didn't do run in the background, with the app killed.
- Snooze opens the app on a small sheet. It offers Later, Tomorrow
  and Pick a day. Later and Tomorrow keep their times and their write.
- Pick a day opens the task on its Due picker. It clears the reminder,
  as a tap on the notification does.
- The notification clears when a choice lands. Closing the sheet
  changes nothing, so the reminder stays.
- Didn't do on a one-off task writes `status: "[[dropped]]"`. It
  writes no `completed`, because the contract keeps that for done.
  The task leaves the open lists and folds under Dropped on the Board.
- Didn't do on a repeat makes the next occurrence, as Done does.
  It then drops this one (ADR 0027). Skipping a day never ends
  the series.
- A dropped task rings no alarm. A second press on it writes nothing.
- An all-day task offers Done and Didn't do. It has no Snooze, for the
  reason above.
- Android freezes a reminder's buttons when we schedule it. The new
  sets have new category ids. Each start schedules a ring from the
  old sets again under the new ones. The channel swap does the same
  for alarms. A reminder already in the tray keeps its old buttons.
  Later and Tomorrow on it still work.

We rejected Didn't do in place of Tomorrow. That keeps three
buttons and costs the one-tap move to tomorrow. We rejected one
merged Later and Tomorrow button. It would keep only one of the
two common times.
