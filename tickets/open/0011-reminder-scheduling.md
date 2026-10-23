---
id: 0011
title: Reminder scheduling service
created: 2026-10-20
priority: normal
assignee:
pr:
depends: [0009]
---

## Spec

Turn `reminders` data into real on-device alarms. No screen of its
own: the upcoming strip idea was absorbed by the Planner's day view
(2026-10-20 decision).

- Scan tasks with `reminders` and schedule exact alarms through the
  path proven in ticket 0001 (`SCHEDULE_EXACT_ALARM`, `delivery:
  alarmClock`).
- Re-run on every app open and after any capture or edit that changes
  reminder data. This covers the 0001 reboot finding: alarms lost by
  force-stop come back on next open.
- Remove stale schedules when reminders are deleted.
- Reuse the 0001 diagnostics screen behind the dev-only route to show
  scheduled state during development.

## Acceptance

- [x] a task with `reminders` fires an on-device notification
- [x] changing or clearing reminders updates schedules
- [x] after a reboot, next app open restores lost schedules

Landed with the local-first store: `syncTaskReminders` moves only the
touched task's alarms, and every vault read runs a full `syncReminders`,
which cancels and rebuilds the schedule set on boot.

Still open: the user has not reported an alarm firing on the phone.
