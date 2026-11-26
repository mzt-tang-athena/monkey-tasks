---
title: The tab rule follows a half swipe again
created: 2026-11-26
priority: high
assignee: omp
pr:
depends: []
---

## Spec

`e2e/specs/pagers.spec.ts:327` "the tab rule follows a half swipe"
fails in the reduced-motion project. It failed 10 of 10 runs on
athena, on main at `e922861` (2026-11-26). Both variants fail,
mouse and touch. CI caught it on PR #250 after a green local gate.

The prime suspect is the store-notification change in the drop
flicker fix (#244). Cache notifications moved from a `setTimeout(0)`
task to a microtask. That PR's own CI passed by timing luck. A
week-body pager test flaked in reduced motion the same day.

- Reproduce it first: the failing spec, reduced motion, on main.
  Confirm the culprit with `git bisect` between `7c84b30` (before
  the notify change) and `e922861`.
- Name the render that misses the tab rule. Decide whether the app
  draws the rule late, or the test waits on a tick the notify change
  removed.
- Fix the smaller of the two. If the app draws the rule late, fix
  the app. If the test waited on a removed tick, fix the test to
  wait on state. Record which, and why, in the PR.
- Mind the gotcha: a paused Playwright clock holds React Query
  renders, and the notify change moved them to microtasks.

## Acceptance

- [ ] The report names the commit that broke it.
- [ ] The test passes 10 of 10 in reduced motion on the fix head.
- [ ] The other pager specs pass, both motion modes.
- [ ] A drop still draws no old-order frame, per the flicker
      fix's own test.

## Outcome

(filled in before moving to done/)
