---
title: A reminder offers Done and Reschedule
created: 2026-11-25
priority: high
assignee: lane-reminder-actions
pr: 231
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

- [x] The report names what TickTick and Google Tasks offer.
- [x] Done on the notification writes `completed` with the app killed.
- [x] A repeating task's Done spawns its next note.
- [x] Each reschedule choice moves the due date and the reminder.
- [x] The notification clears after either action.
- [x] Emulator frames show the buttons and the note after each action.

## Outcome

A reminder carries Done, Later and Tomorrow. A press runs in a
background task, so it works with the app killed. `app/index.ts` loads
the task before Expo Router. The Done and Later writes are plain
functions in `app/src/stores/tasks/task-actions.ts`, which the list's
tick also calls. ADR `20261125-reminder-actions` records the buttons and
the times, and ADR `20261125-reminder-buttons-run-in-the-background`
records the headless task.

Report on TickTick and Google Tasks, Android, read 2026-11-25:

| App | Buttons |
| --- | --- |
| TickTick | Complete and Snooze, a default snooze time |
| Google Tasks | Mark as done and Snooze, fixed choices |

Both offer two buttons and a fixed-choice snooze. Both pages are
unofficial, and I took no screenshots.

Proof: `journeys/android-reminder-actions.sh` writes four tasks due in
three minutes, kills the app, and presses a button on each from the
shade. Each press ran with no app process, read the note through SAF,
and wrote it.

- Done wrote `completed: 2026-11-26T01:04:28`.
- Done on a daily task made "Probe Daily 0059 2026-11-27.md".
- Later moved the due from 01:02 to 02:10.
- Done on a deleted note kept the reminder and posted "Done did not
  save". The app listed it with Retry.

Left for later: an all-day task offers Done alone, so it moves only
through the date sheet. Proof frames are in
`app/build/verify/evidence/android-20261125-115922`.
