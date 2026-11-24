---
title: The app reads deeds as tasks with a status
created: 2026-11-24
priority: normal
assignee:
pr:
depends: []
---

## Spec

Contracts ADR `20261124-deeds-are-tasks-with-a-status` decides that a
deed is a task with a status. This ticket gets deeds into the app.

It depends on contracts ticket `20261124-task-status-and-blocked-by`
and the schemas release that ships it, `0.3.0`. `depends` cannot name
a ticket in another repo, so it stays empty. Do not start until that
release exists.

- Move the app to the schemas release with `status` and
  `blocked by` on the task.
- Read `Deeds/` with `taskFrontmatter`, beside `Tasks/`. One query,
  one task type. The app never branches on the old deed kind.
- Main shows only tasks with no status. A deed never shows there.
- A note in `Deeds/` with no status shows nowhere for now. The 11 such
  notes are reference notes. Ticket `20261124-deed-vault-tidy` moves
  them to `Notes/`.
- The planner and alarms treat a deed like any task. A dated deed
  shows on its day and rings.
- An app edit of a deed note writes `kind: "[[tasks]]"`. It keeps
  every other property, `parent deed`, `categories`, `types` and
  `after` included.
- `npm run vault:check` reads `Deeds/` with `taskFrontmatter` and
  prints the schema's done mismatch warning.
- Update the README's vault section. It names the folders the app
  reads.

Prove it with the `verify-monkey-tasks` skill. Use a preview vault
that holds a deed with a status, one without, and a plain task.

## Acceptance

- [ ] Main shows the plain task and neither deed.
- [ ] A deed with a due date shows on that day in the planner.
- [ ] An app edit of a deed writes the task kind and keeps
      `parent deed` and `after`.
- [ ] `vault:check` passes on the live vault's `Deeds/`.
- [ ] `vault:check` warns on status done with no `completed`.

## Outcome

(filled in before moving to done/)
