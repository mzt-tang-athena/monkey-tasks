---
title: Pager specs stop flaking on CI in reduced motion
created: 2026-11-26
priority: normal
assignee: omp
pr: 263
depends: []
---

## Spec

Two `pagers.spec.ts` tests failed once each on CI, both in the
reduced-motion project. Each passed on rerun, and none failed in
local repeats. A third, a week-body test, hung in `beforeEach` for
two lanes here, never on CI.

- `the tab rule follows a half swipe`, on PR #250. PR #252 fixed
  its read with a poll on state.
- `a swipe on the week body turns the week and the rail follows`
  hung in `beforeEach` for two lanes here, never on CI. See ticket
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

- [x] The report names the shared cause, or says there is none.
- [x] Each racy read waits on state, with no raised timeout.
- [x] `pagers.spec.ts` passes 20 runs, two workers, both modes.

## Outcome

Shared cause, one shape: a resting geometry read taken on the state
that starts a settle. The pager's plain `left` lands in the tab's
render. Its animated `transform` lands in a later one. Until then the
live page sits `(index - pos) * width` over its host.

- The trace of run 45910480357 attempt 1 shows it: 48 ms of
  `left: 1600px; transform: translateX(-400px)`, then 0.
- `pagers.spec.ts:1209` read inside that window and saw 1200 px.
- The tab-rule flake read a settle the same way; #252 polled it.
- The origin read now polls the live page at the pager's origin,
  then reads the track overlap at rest. No timeout moved.
- Every other geometry read in the file waits on state, a stopped
  clock, or is a deliberate single-frame read. Audit in PR 263.
- The week-body hang is separate (`20261126-pager-setup-hang`).
- No app change: the resting layout is right and the window shows
  the old page.

Proof: `pagers.spec.ts` 20 repeats, 2 workers, both projects, 1340
passed, 300 skipped, 0 failed. The gate receipt is on PR 263.
