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

Create `packages/schemas` with hand-written Zod models. They mirror the
agreed vault vocabulary. Planning decided it, and ticket 0004 records
it. The vocabulary is not decided here anymore; the schemas record
it.

- Task notes: required `kind` and `created`. Optional: `completed`
  (date), `due` (date or datetime), `reminders` (list of datetimes,
  more than one allowed), `recurrence` (one RRULE string), `lists`
  (list of wikilinks). Done derives from `completed`: present means
  done.
  Dropped on purpose from this first version: `cancelled`,
  `categories`, `after`. They can return when a need appears.
- Deed notes: the current property set unchanged, plus optional `due`,
  `reminders`, `recurrence`, and a `completed` timestamp written when
  status reaches done.
- List notes: `kind` and `created`.

The schemas keep unknown properties instead of rejecting them, so notes
keep whatever extra frontmatter Obsidian plugins add. Derive TypeScript
types from the schemas. Generate JSON Schema for server-side validation
when a need appears (ADR 0005).

## Acceptance

- [x] Zod models for task, deed, and list notes exist in `packages/schemas`
- [x] task done comes from a derived helper instead of a stored property
- [x] TypeScript types derive from the schemas
- [x] a written property vocabulary sits next to the models

## Outcome

Delivered as `packages/schemas` (Zod 4), PR 2. It includes a lenient
frontmatter text parser and `validateNote` for whole files. It also has
derived done helpers for tasks and deeds, `VOCABULARY.md` as the written
contract, and 21 tests. One test sweeps the live vault: every real deed
note validates.

The live sweep reshaped the deed schema. That was the point of building
it against real data:

- `status` is optional. Ten deeds have no status. 22 deeds carry a
  `parent deed` property, so their parent tracks sub-deeds instead of
  a lifecycle of their own. `parent deed` is now vocabulary.
- Bare values exist in the wild: unquoted statuses and a bare parent
  deed. The schema tolerates and wraps them. The app's write path and
  0005 restore the canonical quoted wikilink form.
- `after` sometimes holds a single wikilink instead of a list. The
  schema normalizes single values into one-item lists.
- Free-form one-offs (`repo`, `pursuit`, `estimate`) survive,
  unmodeled.

Deferred with recorded triggers: `cancelled`, `categories`, `after`
(task-side), `updatedAt`, ordering, subtasks. See ticket 0004.
