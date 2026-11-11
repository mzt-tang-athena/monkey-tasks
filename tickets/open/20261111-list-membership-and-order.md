---
title: One list or many, and what order means
created: 2026-11-11
priority: high
assignee:
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

- [ ] The operator picks one list or many, and what Main means.
- [ ] The meaning of `order` is written down, with its scope.
- [ ] The migration for a note with two links is stated.
- [ ] An ADR records the decision and the rejected option.
- [ ] The build is split into child tickets.

## Outcome

(filled in before moving to done/)
