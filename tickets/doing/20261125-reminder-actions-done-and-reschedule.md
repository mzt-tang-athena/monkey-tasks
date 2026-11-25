---
title: A reminder offers Done and Reschedule
created: 2026-11-25
priority: high
assignee: lane-reminder-actions
pr:
depends: []
---

## Spec

The operator's feedback on 2026-11-25. A reminder notification carries
two buttons: mark the task done, and reschedule it. TickTick and Google
Tasks work this way. Today the notification only opens the app.

- Look at what TickTick and Google Tasks offer on Android first, and
  write it down with screenshots or their docs.
- Done ticks the task from the notification, without opening the app.
  It writes `completed` as a tick in the app does, recurrence included.
- Reschedule offers fixed choices on the notification, such as later
  today or tomorrow. A notification can't hold a date picker. Propose
  the choices, and a way to open the app's date sheet for any other day.
- The action runs with the app closed or killed. Read the Expo SDK docs
  for notification categories and background handling first, as
  `app/AGENTS.md` says.
- A failed vault write must not lose the action. Say what the user sees.

An "archive" or "didn't do" button comes later, in its own ticket.

## Acceptance

- [ ] The report names what TickTick and Google Tasks offer.
- [ ] Done on the notification writes `completed` with the app killed.
- [ ] A repeating task's Done spawns its next note.
- [ ] Each reschedule choice moves the due date and the reminder.
- [ ] The notification clears after either action.
- [ ] Emulator frames show the buttons and the note after each action.

## Outcome

(filled in before moving to done/)
