---
id: 0003
title: MVP screens
created: 2026-10-17
priority: normal
assignee: omp
pr: 209
depends: [0002]
---

## Spec

Parent ticket. The MVP splits into child tickets:

- 0009 Foundation: feature-folder restructure, vault layer, Expo Router
- 0010 Lists route
- 0011 Reminder scheduling service
- 0012 Planner route
- 0013 Task editor and note viewer

Each child carries its own spec and acceptance. 0003 closes when all
children close.

## Acceptance

- [ ] focus list shows and edits today's items
- [ ] upcoming reminders render from vault notes
- [ ] the app can create, edit, and complete tasks

## Outcome

Done before this close. Its children shipped: 0009, 0010, 0011 and 0012, and PR #155 rebuilt the editor. The lists, the planner and the editor all ship. Closed in the 2026-11-24 ticket sort.
