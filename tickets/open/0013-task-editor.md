---
id: 0013
title: Task editor and note viewer
created: 2026-10-20
priority: normal
assignee:
pr:
depends: [0009]
---

## Spec

Edit a task note: rename (file rename), set or clear `due`,
`reminders`, `recurrence`, `lists`, and edit the body. Rename uses
file rename; Obsidian backlinks survive via the standard rename
update. Include a minimal note viewer for deeds (read-only body
render) so the app can display deed notes it encounters.

## Acceptance

- [ ] editing a task's properties writes correct frontmatter
- [ ] renaming a task renames the file and updates in place
- [ ] a deed note opens read-only with body and frontmatter shown
