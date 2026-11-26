---
title: A pager test hangs in setup under load
created: 2026-11-26
priority: normal
assignee: claude-lane-pager-setup-hang
pr:
depends: []
---

## Spec

In full `pagers.spec.ts` runs, one test sometimes hangs 30 s in
`beforeEach`, at the sort button click. Two lanes saw it on
2026-11-26, a different test each time. It never hit in 120 isolated
runs, and CI saw the same wait time out once on PR #244.

- Reproduce it under two workers with the CPU loaded, and record the
  rate.
- Find the cause: the sort click landing before the toolbar settles,
  or a runner stall.
- Fix the cause. Never raise the timeout.

## Acceptance

- [ ] The report names the rate and the cause.
- [ ] Full pagers runs, two workers, pass with no setup hang.

## Outcome

(filled in before moving to done/)
