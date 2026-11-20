---
title: The e2e suite survives a host network change
created: 2026-11-20
priority: normal
assignee: omp
pr:
depends: []
---

## Spec

A full web suite on 2026-11-20 failed one test with a blank page:
`a11y.spec.ts:80`, waiting 5 s for `task-row:Call Mum`. The app and
the test were fine. The same head passed on the rerun and in CI.

The trace shows the cause. Chromium logged
`Failed to load resource: net::ERR_NETWORK_CHANGED` for the JS bundle
on `localhost:8094`. At that same second, 01:01:19 UTC, the host's
`livesync-cli` restarted. Its Docker container stopped, and the kernel
took down its `veth` link on `docker0`. Chromium treats any link change
as a network change and aborts loads in flight, even on `localhost`.

Any container that starts or stops during a suite can blank one
test. The host runs seven, and `livesync-cli` restarts on its own.

A longer timeout cannot help: the bundle never arrives. Fix the cause
at the browser or the fixture. Two options to weigh:

- Stop Chromium watching for network changes in the e2e launch, if a
  supported flag or feature does that.
- In the shared fixture, reload once when the page's entry bundle
  fails with `ERR_NETWORK_CHANGED`, and fail on any other error.

## Acceptance

- [ ] A reproduction: a container stop during a page load blanks it.
- [ ] After the fix, the same stop leaves the test passing.
- [ ] Any other load error still fails the test.
- [ ] No Playwright timeout grows.

## Outcome

(filled in before moving to done/)
