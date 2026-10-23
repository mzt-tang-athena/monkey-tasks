---
id: 0012
title: Planner route
created: 2026-10-20
priority: high
assignee: omp
pr:
depends: [0009]
---

## Spec

The second tab: a Carnet-inspired planner over due dates, per the
2026-10-20 brainstorm. The day is a lens, never stored.

- Month / Week / Day toggle in one route. The app opens on Day mode,
  today.
- Day spread: tasks with `due` that day (timed ones showing their
  time), ordered by time then title. Swipe left and right to move
  between days; capture from a day preselects that day as `due`
  (list stays Main) - the drag-to-day gesture in miniature.
- Week view: seven day columns, the week visualization.
- Month view: grid; tapping a day shows that day's tasks.
- Recurring tasks expand by their RRULE for the visible range
  (rrule.js). Tasks only: no journal prose, no events yet.

## Acceptance

- [x] Day spread shows a task on its due day and only that day
- [x] swiping days works and capture from a day sets that due
- [ ] a recurring task appears on each occurrence in view. The rule
      moves `due` forward on a tick; the planner never expands it.
- [x] Week and Month views render; day tap lists the day

Remaining work: expand a recurrence across the visible range, so a
weekly task shows on each matching day, not only on its stored due
date.

