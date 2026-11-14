---
title: Fold deeds into tasks
created: 2026-11-11
priority: normal
assignee:
pr:
depends: ["0094-review-the-task-note-schema"]
---

## Spec

The vault holds 73 deed notes. The app never reads them. The operator
wants deeds integrated with tasks, and perhaps dissolved into tasks
altogether. This is a spike. No code ships from it.

A deed today carries `kind: "[[deeds]]"`, `status` (backlog, active,
done, dropped, someday), `parent deed`, `categories`, `types`,
`created`, optional `due` and `reminders`. A task carries
`kind: "[[tasks]]"`, `completed`, `due`, `reminders`, `recurrence`,
`recurrence previous` and `lists`.

The two models disagree on what done means. A task counts as done when
`completed` is present. A deed counts as done when `status` is
`[[done]]`.
Both have a due date and reminders. A deed can have a parent deed; a
task cannot.

The vault's own conventions also use `project` and `pursuit` kinds.
Say how deeds relate to those before proposing a merge.

Questions to settle:

1. Are deeds a different thing, an ongoing pursuit or project, or a
   task with a status and no completion date?
2. Which model wins? A task gains `status`, or a deed gains `completed`
   and becomes a task. Otherwise both keep their shape, and the app
   reads deeds as a second surface.
3. What does the app show before the merge? A tab, a filter, a board,
   or nothing.
4. `parent deed`. Does it become `parent` on a task, or does a project
   note own its tasks? Tie this to ticket 0093, which rejects subtasks
   for now.
5. Migration. 73 notes. Is a rewrite acceptable, or does the reader
   accept both shapes first?
6. Recurrence. Deeds have none today. A recurring deed would be a
   task. Say so.

Deliver: a spike report with two or three data models, the migration
cost for each, and a recommendation. Do not build before the operator
picks.

## Acceptance

- [ ] The report lists the shared fields and the conflicting ones.
- [ ] It offers two or three models, with the migration cost of each.
- [ ] It recommends one model and names the breakage.
- [ ] The operator picks a direction, otherwise the idea gets dropped.
- [ ] Child tickets get filed once the operator accepts a model.

## Outcome

(filled in before moving to done/)
