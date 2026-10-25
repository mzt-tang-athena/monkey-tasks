---
id: 0017
title: Planner drag-to-schedule tray
created: 2026-10-20
priority: normal
assignee: omp
pr: 62
depends: [0012]
---

## Spec

The Planner Day spread gains a task pool: an undated (and unscheduled)
task tray docked at the bottom. Tasks can be dragged from the tray up
onto the timeline or day area; dropping sets that task's `due` (date
plus the time slot where it landed). The tray drains as the day fills;
dragging back down unschedules. Desktop drag later, touch drag first.

## Acceptance

- [ ] undated tasks appear in the bottom tray on the Day spread
- [ ] dragging a tray task onto a time slot writes due with that time
- [ ] the tray updates live; unscheduling returns the task to it
