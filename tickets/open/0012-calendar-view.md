---
id: 0012
title: Calendar view
created: 2026-10-20
priority: normal
assignee:
pr:
depends: [0009]
---

## Spec

A month view where tasks with `due` appear on their day; a day tap
shows that day's tasks. Recurring tasks expand by their RRULE for the
visible month (rrule.js, already a dependency). Deeds and events are
out of scope; the vocabulary has no event type yet.

## Acceptance

- [ ] a task with `due` renders on its day in a month grid
- [ ] a recurring task shows on every computed occurrence in view
- [ ] tapping a day lists that day's tasks
