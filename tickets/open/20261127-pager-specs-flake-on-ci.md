---
title: Pager specs stop flaking on CI in reduced motion
created: 2026-11-27
priority: normal
assignee:
pr:
depends: []
---

## Spec

Three different `pagers.spec.ts` tests failed once each on CI, all
in the reduced-motion project. Each passed on rerun, and none
failed in local repeats.

- `the tab rule follows a half swipe`, on PR #250. PR #252 fixed
  its read with a poll on state.
- `a swipe on the week body turns the week and the rail follows`,
  on PR #244. It hung in `beforeEach`; see ticket
  `20261126-pager-setup-hang`.
- `a page lays out at the pager's origin, so Android can read it`
  (`pagers.spec.ts:1186`), on PR #261, run 45910480357. It passed
  10 of 10 locally.

Look for the shared cause before fixing each test alone. One
candidate: a geometry read that runs before the reduced-motion jump
lands, on a slower CI runner. Read each spec for reads taken
straight after an action with no wait on state.

- Pull the failed run's trace and screenshot for the third test.
- Audit every geometry read in `pagers.spec.ts` for a missing wait.
- Fix the reads that can race. Never raise a timeout.

## Acceptance

- [ ] The report names the shared cause, or says there is none.
- [ ] Each racy read waits on state, with no raised timeout.
- [ ] `pagers.spec.ts` passes 20 runs, two workers, both modes.

## Outcome

(filled in before moving to done/)
