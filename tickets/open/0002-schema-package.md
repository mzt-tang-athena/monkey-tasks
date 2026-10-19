---
id: 0002
title: Schema package
created: 2026-10-17
priority: high
assignee:
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

- [ ] Zod models for task, deed, and list notes exist in `packages/schemas`
- [ ] task done is a derived helper, not a stored property
- [ ] TypeScript types derive from the schemas
- [ ] the property vocabulary is written down next to the models
