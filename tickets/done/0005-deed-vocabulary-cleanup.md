---
id: 0005
title: Deed vocabulary cleanup migration
created: 2026-10-19
priority: low
assignee: omp
pr: 211
depends: []
---

## Spec

One-time vault migration, run when confident. Three changes across the
72 deed notes:

1. Rename `after` to `blocked by`. The rule the name encodes: each
   linked note must finish first. The linked note is the predecessor.
2. Fold or drop `types` (10 deeds use it) into tags or category links.
   Nothing loses its meaning; the migration moves values and never
   deletes them.
3. Backfill `created` from file metadata where the property is missing.

Updates the deed template and every Bases filter that references the
old names. Until this lands, the app and the schema package accept both
`after` and `blocked by`.

## Acceptance

- [ ] no deed carries `types` or `after`
- [ ] the deed template and deeds.base reference the new names
- [ ] a before/after diff of every touched deed exists in the PR

## Outcome

Closed on 2026-11-24 without a run. Ticket `20261124-deed-vault-tidy`
takes its work.

The deeds decision changed item 1. Most `after` links mean order, not
a blocker, so a plain rename to `blocked by` would be wrong. The tidy
splits each link with the operator. Items 2 and 3 move over as they
are. The decision is contracts ADR
`20261124-deeds-are-tasks-with-a-status`.

The spec said 12 deeds use `types`. The spike counted 10 on
2026-11-24, and the spec now says 10.
