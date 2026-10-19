---
id: 0011
title: Upcoming reminders screen
created: 2026-10-20
priority: normal
assignee:
pr:
depends: [0009]
---

## Spec

A chronological list of everything scheduled: tasks with `due` and
`reminders`, grouped by day, upcoming first. Overdue items lead.
Each row shows which reminder fires when; scheduling actual
notifications from this data reuses the 0001 alarm knowledge.

## Acceptance

- [ ] tasks with dates render grouped by day in order
- [ ] overdue items appear at the top
- [ ] a task with `reminders` schedules a real on-device notification
