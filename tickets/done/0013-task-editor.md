---
id: 0013
title: Task editor and note viewer
created: 2026-10-20
priority: normal
assignee: omp
pr: PRNUM
depends: [0009]
---

## Spec

Edit a task note: rename (file rename), set or clear `due`,
`reminders`, `recurrence`, `lists`, and edit the body. Include a
minimal note viewer for deeds (read-only body render) so the app can
display deed notes it encounters.

Constraint found on 2026-10-23: Android SAF has no rename call.
`expo-file-system` cannot move a `content://` document, so a rename
creates the new file, writes the text, and deletes the old one.
Obsidian sees a delete and a create, not a rename, so links to the old
name do not follow. The editor warns once on the first rename.

## Acceptance

- [ ] editing a task's properties writes correct frontmatter
- [ ] renaming a task renames the file and updates in place
- [ ] a deed note opens read-only with body and frontmatter shown

## Outcome

Done before this close. PR #155 rebuilt the editor as a sheet, with the rename path in `task-editor-provider.tsx`. The deed viewer went with ticket 0094, since the app never reads deeds. Closed in the 2026-11-24 ticket sort.
