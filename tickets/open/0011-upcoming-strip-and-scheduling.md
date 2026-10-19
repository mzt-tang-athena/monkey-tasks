---
id: 0011
title: Upcoming strip and reminder scheduling
created: 2026-10-20
priority: normal
assignee:
pr:
depends: [0009, 0010]
---

## Spec

There is no separate upcoming tab (decided 2026-10-20): the focus
screen carries a compact "next 7 days" strip under today's items, and
the calendar's day tap is the drill-down. This ticket does the two
parts that are neither screen's main body:

- The focus screen's upcoming strip: tasks with `due` in the next
  seven days, grouped by day, overdue leading.
- Reminder scheduling: tasks with `reminders` schedule real on-device
  notifications through the exact-alarm path proven in 0001, re-run on
  every app open (the 0001 reboot finding), and refresh after any
  capture or edit that changes reminder data.

## Acceptance

- [ ] the focus screen shows the next 7 days grouped by day
- [ ] a task with `reminders` schedules a real on-device notification
- [ ] notifications re-schedule after reboot-related loss, on next
      app open
