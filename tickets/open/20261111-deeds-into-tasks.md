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

## Findings

Measured on 2026-11-24, read-only, against `/home/monkey/vault/main`.
The vault holds 73 deed notes: 72 in `Deeds/` and the deed template.
The numbers below count the 72.

### What the deeds hold

- `status`: 48 backlog, 9 someday, 4 active, 11 empty.
- No deed carries done or dropped. Vault history since 2026-10-02
  shows none ever did.
- Three status values and one `parent deed` lack link brackets.
- `parent deed`: 22 child deeds under 6 parents, depth 1.
- Every empty status is a child deed, as the contract intends.
- `categories`: 19 deeds, 28 links. 27 reach a waypoint, 1 nothing.
- `types`: 10 deeds. 9 links reach a note in `Notes/`, 2 reach
  nothing.
- `after`: 6 deeds, plus 1 that spells it `do this after`.
- `created`: 57 deeds. 15 lack it.
- `due`, `reminders`, `completed`, `recurrence`, `blocked by`: 0.
- Bodies: 157 checkboxes in 31 deeds, 138 of them open.
- 7 deed bodies embed a note from `20-Projects/`.

The 15 task notes, for scale: 11 completed, 8 due, 7 list,
6 reminders, 6 recurrence. No task has a status or a parent.

### Shared and conflicting fields

| Field | Deed | Task | Verdict |
|---|---|---|---|
| `kind` | `[[deeds]]` | `[[tasks]]` | differ by design |
| `created` | date, 57 of 72 | datetime, all | shared |
| `due` | allowed, 0 used | 8 of 15 | shared |
| `reminders` | allowed, 0 used | 6 of 15 | shared |
| `recurrence` | allowed, 0 used | 6 of 15 | shared |
| `completed` | allowed, 0 used | done marker | conflict |
| `status` | done marker, 62 | none | conflict |
| `parent deed` | 22 | none | deed only |
| `categories` | 19 | none | deed only |
| `list` | none | 7 | task only |

The done conflict is real in the contract and empty in the data. No
deed carries a date of any kind beyond `created`.

### Question 1: what a deed is

A deed is a project.

- The deed status set is the old `project` status set, word for word.
- `parent deed` is the old project `parent`, renamed.
- 43 of the 64 folders in `20-Projects/` share a name with a deed.
- `categories` points at waypoints. Waypoints replaced the old
  `pursuit` and `domain` pair: `digital`, `mental` and the rest.
- The real to-dos live inside deeds, as 138 open checkboxes.

The vault moved from the PARA tree to Waypoints, Deeds and Notes on
2026-10-02. The vault note `record-system-decisions` calls PARA the
old tree. It still holds 17 project notes, 4 pursuits and 4 tasks
with `kind: task`. The vault `AGENTS.md` still describes PARA. That
mismatch is a vault cleanup and stays out of this ticket.

The map: pursuit became waypoint and project became deed. The PARA
task became a checkbox or a task note.

### Three models

**A. Fold deeds into tasks.** A deed becomes a task note.

- The contract drops `deedFrontmatter`. Tasks gain `status`,
  `parent` and `categories`.
- Backlog, someday and active have no task form, so tasks keep
  `status` and two done rules now share one kind.
- It reverses the task note schema ADR twice: tasks gain a status,
  and tasks gain a parent.
- The app needs status in the editor and parent rows in lists.
- Main shows every task, so 72 undated rows flood it.
- The vault rewrite touches all 72 notes, moves them to `Tasks/`,
  and rewrites `deeds.base`, the template and 7 embeds. Ticket 0005
  dissolves into it.

**B. Deeds stay projects; a task links to one.** Two kinds, one
link.

- The contract adds one optional task field, `deed`, a wikilink.
- It drops `recurrence` and `reminders` from the deed schema.
  No deed uses them, and a deed that recurs is a task.
- The app reads `Deeds/` the way it reads lists, and gains a deed
  picker in the task editor.
- The vault rewrite touches 0 notes. The reader already accepts
  every shape the deeds use.
- Each deed keeps its own done rule, `status`. A project ends when
  the operator says so, not when its last task does.
- Checkboxes stay in the deed body. One gets promoted to a task note
  when it needs a date or an alarm.

**C. A read-only deed surface.** Nothing links.

- No contract change. No vault rewrite.
- The app reads `Deeds/` and shows active and backlog deeds.
- It does not integrate anything, so it fails the operator's goal.
  C is the first half of B, and B can ship as C first.

### Migration cost

| | A, fold | B, link | C, read |
|---|---|---|---|
| Contract change | large: 3 task fields, deed type gone | small: 1 task field, 2 deed fields cut | none |
| App work | status UI, parent rows, Main filter | deed loader, filter, editor picker | deed loader, one screen |
| Notes rewritten | 72, plus a folder move | 0 | 0 |
| Bases and template | rewrite both | none | none |
| ADRs reversed | task note schema, twice | none | none |
| Ticket 0005 | absorbed | optional, 30 notes | optional, 30 notes |
| Integrates deeds | yes | yes | no |

Ticket 0005 claims 72 notes. Its real reach is 28: 7 `after`,
10 `types` and 15 missing `created`. Fixing the bare values makes 30.

### The other questions

- **Question 2, which model wins.** Neither absorbs the other. Both
  keep their shape and a task points at its deed.
- **Question 3, the app before the merge.** Nothing until the operator
  picks. Under B, the first build is a filter on the Lists screen.
  It shows one row per active deed, with its tasks under it. No board. Obsidian's
  deed kanban already does that, and 4 active deeds do not fill one.
- **Question 4, `parent deed`.** It stays on deeds as a deed-to-deed
  link. Tasks get no `parent`, so ticket 0093's no-subtasks call holds.
  A task joins a project through `deed`, a membership and not a tree.
- **Question 5, migration.** Under B nothing is rewritten. The reader
  already accepts both shapes. Run 0005 later as a 30-note tidy, or
  drop it; B does not need it.
- **Question 6, recurrence.** 0 of 72 deeds recur. A recurring thing
  is a task. B removes `recurrence` from the deed contract to say so.

### What B breaks

- Tasks gain one more field and the editor a picker.
- Two done rules remain, one per kind, on purpose.
- 138 checkboxes stay invisible to the app until promoted.
- The `deed` field cuts against the 0094 line "no new field, use
  lists and references". A task has one list. A deed used as a list
  would evict the task from Groceries.
- A body reference does not mean membership. Bases can find the link
  but cannot tell it from any other mention.
- An ADR records that trade-off once the operator picks B.

Base problems seen, not fixed:

- `deeds.base`: the Backlog and Done views filter with `!=`, so each
  shows the opposite set.
- The vault `AGENTS.md` describes the old PARA tree.
- 2 `types` links and 1 `categories` link point at no note.

**Operator's question:** fold deeds into tasks (A), link tasks to
deeds (B), or only show deeds (C)?

**Recommendation: B.** A deed is a project, and the data says so. B
gets deeds into the app with no vault rewrite and no reversed ADR.
A pays a 72-note rewrite to merge two things that are not the same.

## Acceptance

- [x] The report lists the shared fields and the conflicting ones.
- [x] It offers two or three models, with the migration cost of each.
- [x] It recommends one model and names the breakage.
- [ ] The operator picks a direction, otherwise the idea gets dropped.
- [ ] Child tickets get filed once the operator accepts a model.

## Outcome

(filled in before moving to done/)
