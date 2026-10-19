---
id: 0002
title: Schema package
created: 2026-10-17
priority: high
assignee: opencode
pr:
depends: [0001]
---

## Spec

Create `packages/schemas` with hand-written Zod models mirroring the
agreed vault vocabulary, decided in planning and recorded in ticket
0004. The vocabulary is not decided here anymore; the schemas record
it.

- Task notes: required `kind` and `created`; optional `completed`
  (date), `due` (date or datetime), `reminders` (list of datetimes,
  several allowed), `recurrence` (one RRULE string), `lists` (list of
  wikilinks). Done is derived: `completed` present means done.
  Deliberately dropped from this first version: `cancelled`,
  `categories`, `after`. They can return when a need appears.
- Deed notes: the current property set unchanged, plus optional `due`,
  `reminders`, `recurrence`, and a `completed` timestamp written when
  status reaches done.
- List notes: `kind` and `created`.

Unknown properties are preserved, not rejected, so notes keep whatever
extra frontmatter Obsidian plugins add. Derive TypeScript types from
the schemas. JSON Schema for server-side validation is generated when
a need appears (ADR 0005).

## Acceptance

- [x] Zod models for task, deed, and list notes exist in `packages/schemas`
- [x] task done is a derived helper, not a stored property
- [x] TypeScript types derive from the schemas
- [x] the property vocabulary is written down next to the models

## Outcome

Delivered as `packages/schemas` (Zod 4), PR 2. Includes a lenient
frontmatter text parser, `validateNote` for whole files, derived done
helpers for tasks and deeds, `VOCABULARY.md` as the written contract,
and 21 tests. One test sweeps the live vault: every real deed note
validates.

The live sweep reshaped the deed schema, and that was the point of
building it against real data:

- `status` is optional. Ten deeds have no status; 22 deeds carry a
  `parent deed` property, so sub-deeds are tracked by their parent,
  not by a lifecycle of their own. `parent deed` is now vocabulary.
- Bare values exist in the wild: unquoted statuses and a bare parent
  deed. The schema tolerates and wraps them; the canonical quoted
  wikilink form is restored by the app's write path and by 0005.
- `after` sometimes holds a single wikilink instead of a list. The
  schema normalizes single values into one-item lists.
- Free-form one-offs (`repo`, `pursuit`, `estimate`) are preserved,
  unmodeled.

Deferred with recorded triggers: `cancelled`, `categories`, `after`
(task-side), `updatedAt`, ordering, subtasks. See ticket 0004.
