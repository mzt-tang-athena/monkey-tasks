---
title: The app reads deeds as tasks with a status
created: 2026-11-24
priority: normal
assignee: opencode
pr: 224
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

- [x] Main shows the plain task and neither deed.
- [x] A deed with a due date shows on that day in the planner.
- [x] An app edit of a deed writes the task kind and keeps
      `parent deed` and `after`.
- [x] `vault:check` passes on the live vault's `Deeds/`.
- [x] `vault:check` warns on status done with no `completed`.

## Outcome

Contracts pin at `68fa006` (schemas 0.3.0). The app reads `Deeds/`
beside `Tasks/` in one query, with the task schema. Main and the list
tabs keep the tasks with no status. A deed note with no status is not
a row at all. The planner shows a dated deed on its day, and the
alarms ring for it.

An app write of a deed takes the task shape: the task kind, and a
`created` date when it had none. `parent deed`, `categories`, `types`
and `after` stay byte for byte. A tick writes status done with
`completed`; an untick writes backlog.

`vault:check` reads Deeds/ with the task schema. A warning now points
at the property it names, so a done mismatch shows on `status` or
`completed`, never on `alert weight`.

The live vault shows 72 deeds, all parsed: 61 with a status and 11
reference notes. `vault:check` finds nothing in 474 notes. A read never
wrote a byte, and a test diffs every deed fixture.

The product calls are in ADR `20261124-a-deed-shows-on-its-day`. A
deed shows on no list tab and in neither of the planner's named
sources. The repair notice skips deeds. An untick goes to backlog. A
recurring deed's next note is a plain task. The board ticket inherits
the tick rule and can revisit each call.

Proof: the unit and component suites. The full web suite in both
motion projects. A read-only sweep of `~/vault/main`. An emulator pass
on port 5572. Evidence is in
`~/code/monkey-tasks/worktrees/evidence-deeds-as-tasks/`.
