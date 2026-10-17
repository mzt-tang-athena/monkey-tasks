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

Create `packages/schemas` with hand-written Zod models for task, reminder,
and event notes, based on the vault property vocabulary. Derive TypeScript
types from the schemas. Decide the final property vocabulary here; it is
the contract for every client.

## Acceptance

- [ ] Zod models for task, reminder, and event exist in `packages/schemas`
- [ ] TypeScript types derive from the schemas
- [ ] the property vocabulary is written down next to the models
