---
id: 0014
title: My order sort with manual ordering
created: 2026-10-20
priority: low
assignee: omp
pr:
depends: [0010]
---

## Spec

The hand-ordered sort from the 2026-10-20 brainstorm (the Focus-list
habit). Tasks gain an optional `order` number property; the sort
sheet gains "My order"; rows reorder by drag within a list. Manual
order is meaningful per list; the property is a single number, and
tasks usually live in one list.

## Acceptance

- [ ] the sort sheet gains My order
- [ ] dragging a row reorders it and writes `order`
- [ ] tasks without `order` sort after ordered ones
