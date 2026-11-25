---
title: The two fast drags test is flaky
created: 2026-11-25
priority: normal
assignee:
pr:
depends: []
---

## Spec

`app/e2e/specs/pagers.spec.ts`, "two fast drags move two tabs", failed
once on 2026-11-25 with two workers. It passed alone and in both full
gate runs. The test flicks twice 100 ms apart, so a loaded host can
drop one flick.

A flaky test hides real failures and wastes gate time. Fix the cause.
Keep the timeout and the retry count as they are.

- Find the real cause. The second flick may start before the pager
  settles, or land while the first animation still runs.
- Wait on a state the pager shows, not on a fixed delay. The paused
  clock pattern the suite already uses is a candidate.
- Keep the test's meaning: two fast drags move two tabs.

## Acceptance

- [ ] Ten runs with two workers, no retries, all pass.
- [ ] The test still fails when the pager ignores the second flick.
- [ ] The test keeps its timeout and its retry count.

## Outcome

(filled in before moving to done/)
