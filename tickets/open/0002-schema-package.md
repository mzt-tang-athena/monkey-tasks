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
agreed vault vocabulary, decided in planning on 2026-10-19 and recorded
in ticket 0004. The vocabulary is not decided here anymore; the schemas
record it.

- Task notes: required `kind` and `created`; optional `completed`,
  `cancelled`, `due`, `remind`, `repeat` as an RRULE string, `lists`,
  `categories`, `after`. At most one of `completed` and `cancelled`.
  Derived helper: done means `completed` is present.
- Deed notes: the current property set unchanged, plus optional `due`,
  `remind`, `repeat`, and a `completed` timestamp written when status
  reaches done.
- List notes: `kind` and `created`.

Accept both `after` and `blocked by` until ticket 0005 lands. Unknown
properties are preserved, not rejected, so notes keep whatever extra
frontmatter Obsidian plugins add. Derive TypeScript types from the
schemas. JSON Schema for server-side validation is generated when a
need appears (ADR 0005).

## Acceptance

- [ ] Zod models for task, deed, and list notes exist in `packages/schemas`
- [ ] task done is a derived helper, not a stored property
- [ ] TypeScript types derive from the schemas
- [ ] the property vocabulary is written down next to the models
