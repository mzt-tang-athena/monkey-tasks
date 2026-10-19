---
id: 0004
title: Task and list note types in the vault
created: 2026-10-19
priority: normal
assignee: opencode
pr: 4
depends: []
---

## Spec

Add the lightweight task type alongside deeds, as agreed in the
2026-10-19 planning session. Tasks are one file per task in a new
`Tasks/` folder. The filename is the task name. The body is optional
free text, usually empty. List notes live in `Tasks/Lists/`.

Task note required frontmatter:

- `kind: "[[tasks]]"`
- `created: <date>`

Task note optional frontmatter. Absent means the default:

- `completed: <date>` - present means done; absent means open
- `due: <date or datetime>` - the day the task matters
- `reminders: [<datetime>...]` - when the phone buzzes; several allowed
- `recurrence: <RRULE string>` - iCalendar recurrence for due
- `lists: [<wikilinks>]` - list notes this task belongs to

Tasks carry no `status` property. Done is derived: `completed` present
means done. Deliberately dropped from this first version: `cancelled`,
`categories`, `after`. They can return when a need appears. Also
deferred: `updatedAt`, until a consumer exists (incremental sync on
athena, offline edit conflicts, or date queries). If added, every
writer family stamps it: the app, vault agents, and an Obsidian plugin. Deeds keep
their current shape untouched, including the five-value `status`. List
notes carry `kind: "[[lists]]"` and `created`. Checkbox lines inside any
note body are throwaway checklists the app ignores: anything needing a
date, reminder, or list is a task file.

Also add: a Templater task template mirroring the deed template, moving
new notes into `Tasks/`; a `lists.base` next to `deeds.base` in
`Templates/Bases/`; a `lists.md` dashboard embedding it, matching the
`deeds.md` pattern. The app and all views filter by `kind`, never by
folder path.

## Acceptance

- [x] a task note created from the template lands in `Tasks/` (pending
      one manual check in Obsidian; template mirrors the proven deed
      template)
- [x] a lists view groups task notes by their `lists` value
- [x] existing deeds render unchanged in their Bases views
- [x] property meanings are written down next to the deed status table

## Outcome

Done in the vault repo (commit 466a4ef), PR 4 carries the record.

- `Tasks/` and `Tasks/Lists/` exist, seeded with `.gitkeep`.
- `Templates/Templater/task template.md` mirrors the deed template:
  `kind`, `created` stamped by Templater, empty `lists`, and the move
  into `/Tasks/`.
- `Templates/Bases/lists.base` has a kanban view grouped by `lists`
  and an all-tasks table; the kanban idiom matches the vault's
  existing `types.base`, which already groups by an array property.
- Root `lists.md` dashboard embeds it, matching `deeds.md`.
- `deeds.md` gained a "Task notes" section with the property table,
  next to the status values table, pointing at `VOCABULARY.md` in the
  contracts repo.

First two acceptance lines need one check in Obsidian: create a task
from the template (it should land in `Tasks/`), and open the lists
dashboard.
