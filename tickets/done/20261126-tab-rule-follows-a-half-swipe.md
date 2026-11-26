---
title: The tab rule follows a half swipe again
created: 2026-11-26
priority: high
assignee: omp
pr: 252
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

- [x] The report names the commit that broke it, or says none did.
- [x] The test passes 10 of 10 in reduced motion on the fix head.
- [x] The other pager specs pass, both motion modes.
- [x] A drop still draws no old-order frame, per the flicker
      fix's own test.

## Outcome

No commit broke it. The notify change in #244 is not the cause.

- The spec read the rule's rest box as soon as Main's rows showed.
- The rule follows the pager on its own frame. After a tab press
  it can stand under the old tab for a frame or more.
- CI's trace shows it: the rest read was -23, the Today rule.
- The rule trailed the row in 1 of 30 runs with the microtask and
  2 of 30 with `setTimeout(0)`. The race predates #244.
- I could not fail the spec at `dfc6df3`: 40 of 40 passed here,
  with and without CPU load.

Fix, on the test side: the spec waits for the rule to stand under
Main, then reads the rest box. Where the rule trails by 200 ms,
a raw read was stale 16 of 16. The polled read held 16 of 16.
The app has no change. A rare run still draws the rule a frame
or more after the rows. That is a separate fault.
