---
id: 0005
title: Deed vocabulary cleanup migration
created: 2026-10-19
priority: low
assignee:
pr:
depends: []
---

## Spec

One-time vault migration, run when confident. Three changes across the
72 deed notes:

1. Rename `after` to `blocked by`. The rule the name encodes: each
   linked note must finish first. The linked note is the predecessor.
2. Fold or drop `types` (12 deeds use it) into tags or category links.
   No meaning is lost; values are moved, never deleted.
3. Backfill `created` from file metadata where the property is missing.

Updates the deed template and every Bases filter that references the
old names. Until this lands, the app and the schema package accept both
`after` and `blocked by`.

## Acceptance

- [ ] no deed carries `types` or `after`
- [ ] the deed template and deeds.base reference the new names
- [ ] a before/after diff of every touched deed exists in the PR
