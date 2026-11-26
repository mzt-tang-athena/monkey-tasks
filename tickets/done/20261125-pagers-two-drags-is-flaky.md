---
title: The two fast drags test is flaky
created: 2026-11-25
priority: normal
assignee: poteto-mode
pr: 238
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

The gap raced the pager's 220 ms settle, so where the second drag
started followed the host's frame rate. The test now pauses the page
clock. It flicks, then steps one frame so the track stands between the
pages. The second flick starts with the landing still pending. The test
runs the settle out and resumes.

The second drag's begin lands the pending page, so the drags move Main
to Errands to Finance. No timeout or retry changed.

Proof: 10 repeats at two workers, no retries, 40 pass. With the pager's
begin stopping the pending commit, both motion variants fail. With the
pager committing only the first flick, all four variants fail.

Found while tracing: a drag's release carries the last pointer move the
gesture stack processed, not the final position. That is why the flick
steps one frame with the button down before it releases.
