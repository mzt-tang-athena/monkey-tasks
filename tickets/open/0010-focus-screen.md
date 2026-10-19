---
id: 0010
title: Focus screen
created: 2026-10-20
priority: high
assignee:
pr:
depends: [0009]
---

## Spec

The first screen, the habit anchor. Shows today's tasks: due today,
overdue, and tasks with no date that the user pinned to today.
Capture box stays at the top. Ticking a task writes `completed`;
unticking removes it. Long-press or tap opens the task editor (0013)
when it exists.

Spec discipline: what belongs in "today" is a product decision to
confirm with the user before building.

## Acceptance

- [ ] the screen lists today's tasks from the vault
- [ ] completing and uncompleting writes `completed` correctly
- [ ] capture from the focus screen creates a task that appears in
      the list
