# Task note schema

- **Status:** accepted for the fields below. Three questions stay open.
- **Date:** 2026-11-11

## Context

A task note carries ten frontmatter fields. The app is ahead of the live
vault, which holds 8 task notes and uses only `kind`, `created` and
`due`. Absence in the vault is not proof a field is useless.

The review is ticket 0094. The operator wants a schema that serves the
journal, the planner and a future dashboard. Some fields have a shape
that will not serve them. A few gained meaning by accident.

Two rules shape the review. Never rewrite the vault in bulk. The
parser always reads every old shape.

## Decision

We keep the field set and change three shapes.

| Field | Decision |
|---|---|
| `completed` | Takes a time as well as a date. New writes carry a local timestamp. Old dates stay valid. |
| `created` | Same. New notes carry the minute; old dates stay valid. |
| `due` | Keeps date or datetime. A timed due rings. `reminders` holds extra alerts. |
| `kind` | The parser accepts a bare value and the link form. The app writes only the link form. |
| `title` | Keeps its place. It names a note whose file name is not the display name. |
| `order` | Keeps its meaning as a manual rank. Its scope depends on the list question below. |
| `recurrence` | Unchanged. A spawned occurrence carries the parent's fields. |
| `lists` | Unchanged for now. One list or many is open. |
| `reminders` | Unchanged shape. The weight is open. |

We add no field for priority. We add no `parent` field. A reference
stays in the note body, with no extra rules until a case needs them.

We rejected a scheme of vague priority levels. The operator does not
use them, and a need versus a cue is reminder weight, not priority.

We rejected subtasks as a `parent` field. A parent chain in frontmatter
is a second ordering system, and lists and references already express
most of it. If subtasks earn their place later, they start there.

We rejected rewriting the 73 deed notes into tasks here. That decision
needs the deed spike, and it is its own model question.

## Consequences

A `completed` time means a section groups by the date part, not the
whole string. Anything that compares completion to "today" reads the
date part. A value without a time keeps working, so no note changes.

Accepting both `kind` shapes makes a hand-written note readable. The
write rule stays one shape, so the app never produces the bare form.

A timed due that rings needs the notification path to reconcile on
tick, edit and delete. A reminder that repeats the due time must not
ring twice.

Three questions stay open, each in its own ticket. They are reminder
weight, one list or many, and deeds into tasks. The fields this ADR
touches do not move until those settle.

The three changes are child tickets, each with its own migration note:
`20261111-completed-takes-a-time`, `20261111-kind-accepts-both-shapes`
and `20261111-a-timed-due-rings`.

## Amendment, 2026-11-14: one list and a whole-tab order

ADR `20261111-one-list-and-tab-order` settles the list question.
A task carries one `list`, a single wikilink. The parser still reads an
old `lists` and takes its first link.

`order` ranks the whole tab in My order. Due order keeps its date
sections, and `order` does not apply there.
