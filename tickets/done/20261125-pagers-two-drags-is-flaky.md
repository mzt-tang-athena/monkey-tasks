---
title: The two fast drags test is flaky
created: 2026-11-25
priority: normal
assignee: poteto-mode
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

- [x] Ten runs with two workers, no retries, all pass.
- [x] The test still fails when the pager ignores the second flick.
- [x] The test keeps its timeout and its retry count.

## Outcome

The 100 ms gap raced the pager's 220 ms settle. How far the settle had
gone when the second drag started followed host load. The test now
waits for the first drag's page (`Errands` selected) to land before the
second drag. No fixed delay remains. No timeout or retry changed.

Found while tracing: a drag's release carries the translation of the
last pointer move the gesture stack processed. That move sits one
30 px step behind the last move sent. A 120 px flick reads as 90 px
against the 80 px commit. Both drags clear it, with one step of margin.

Proof: 40 then 80 executions of the test at two workers with no
retries, all pass. With the pager changed to commit only the first
flick, all four variants fail on the Finance assertion.
