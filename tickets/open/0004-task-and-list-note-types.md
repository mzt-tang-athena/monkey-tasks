---
id: 0004
title: Task and list note types in the vault
created: 2026-10-19
priority: normal
assignee:
pr:
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
- `cancelled: <date>` - present means deliberately not done
- `due: <date or datetime>` - the day the task matters
- `remind: <datetime>` - when the phone buzzes
- `repeat: <RRULE string>` - iCalendar recurrence for due and remind
- `lists: [<wikilinks>]` - list notes this task belongs to
- `categories: [<wikilinks>]` - waypoint links, same meaning as deeds
- `after: [<wikilinks>]` - each linked note must finish first

Tasks carry no `status` property. Done is derived: `completed` present
means done. Schema invariant: at most one of `completed` and
`cancelled`. Deeds keep their current shape untouched, including the
five-value `status`. List notes carry `kind: "[[lists]]"` and
`created`. Checkbox lines inside any note body are throwaway checklists
the app ignores: anything needing a date, reminder, or list is a task
file.

Also add: a Templater task template mirroring the deed template, moving
new notes into `Tasks/`; a `lists.base` next to `deeds.base` in
`Templates/Bases/`; a `lists.md` dashboard embedding it, matching the
`deeds.md` pattern. The app and all views filter by `kind`, never by
folder path.

## Acceptance

- [ ] a task note created from the template lands in `Tasks/`
- [ ] a lists view groups task notes by their `lists` value
- [ ] existing deeds render unchanged in their Bases views
- [ ] property meanings are written down next to the deed status table
