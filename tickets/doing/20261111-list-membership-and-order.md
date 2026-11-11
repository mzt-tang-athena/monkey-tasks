---
title: One list or many, and what order means
created: 2026-11-11
priority: high
assignee: omp
pr:
depends: ["0094-review-the-task-note-schema"]
---

## Spec

`lists` is a list of wikilinks. Main shows every task. Any other tab
shows the tasks whose `lists` carries that name. The editor allows
many lists.

`order` is a number written by the reorder. Today it is a rank inside
one date section, not a global order.

If a task belongs to two lists, one `order` cannot order it in both.
The operator is open to limiting a task to one list, but wants the
trade-offs first.

Questions to settle:

1. One list or many. If one, is the property `list: [[Focus]]` or
   `lists: [[Focus]]` with one item? What does Main mean then, every
   task or the unfiled bucket?
2. If many, where does a per-list rank live? On the task it needs two
   values. On the list note it is a list of links in order. In a
   separate note it is another file to keep in sync.
3. If one, does `order` rank the whole tab or only a date section? The
   drag today is per section. A global order needs the drag to cross
   sections.
4. What is the migration? The live vault has no task with `lists`, so
   a change is cheap now. Say what happens to a note that carries two
   links.
5. The editor. Many lists need a multi-select. One list needs a single
   picker. Ticket 0093 rebuilds the editor, so settle this before it
   ships.

Deliver: a decision and an ADR, then child tickets. No code from this
ticket.

## Acceptance

- [x] The operator picks one list or many, and what Main means.
- [x] The meaning of `order` is written down, with its scope.
- [x] The migration for a note with two links is stated.
- [x] An ADR records the decision and the rejected option.
- [x] The build is split into child tickets.

## Outcome

Decided 2026-11-11.

- One list per task. The note carries `list`, one wikilink. The parser
  takes the first link of an old `lists`.
- Main holds the unfiled tasks. It is no longer a catch-all.
- `order` is the whole tab in My order. Due order keeps its date
  sections, and `order` does not apply there.
- Migration: no bulk write. A two-link note resolves to its first link,
  and the next save of that task drops the rest.
- Rejected: many lists. Each tab would need its own rank, and the only
  use case, subtasks built from lists, can wait.

ADR: `docs/adr/20261111-one-list-and-tab-order.md`. ADR 0015 and ADR
0031 carry dated amendments.

Child tickets: `20261111-one-list-field`,
`20261111-main-holds-unfiled-tasks`, `20261111-order-the-whole-tab`
and `20261111-single-list-picker`.
