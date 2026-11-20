---
title: The e2e suite survives a host network change
created: 2026-11-20
priority: normal
assignee: omp
pr: 194
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

- [x] A reproduction: a container stop during a page load blanks it.
- [x] After the fix, the same stop leaves the test passing.
- [x] Any other load error still fails the test.
- [x] No Playwright timeout grows.

## Outcome

No Chromium switch or feature turns the abort off. The network service
takes the change from the browser process, and `--ignore-netif` exists
only in the `net_watcher` dev tool. The fix is the shared fixture.

`app/e2e/fixtures.ts` reloads once when a request to the page's own
origin fails with `net::ERR_NETWORK_CHANGED`. It waits for the load
event, so a pending `page.goto` is not cancelled. It also tries the
reload twice in case a change aborts it. Everything else passes through.

`app/e2e/specs/network-change.spec.ts` proves it. A page boots from a
fetch that waits behind twenty fetches holding the origin's sockets.
Adding and removing a docker network during the load aborts it, which
is the incident's error.

A plain container stop removes only the veth's IPv6 link-local
address, and Chromium 156 does not report that. Removing a network
takes an IPv4 address off a bridge, and it does.

Proof, by Acceptance line:

- Repro: pre-fix both projects failed the spec.
  The trace shows `boot.js` with `net::ERR_NETWORK_CHANGED`,
  14 queued fetches aborted, and a blank page.
- After the fix: six consecutive runs passed 4/4.
- Other errors: the second spec refuses the boot fetch with
  `net::ERR_CONNECTION_REFUSED` and expects failure. A reload would
  fetch the live address and boot, so a wrong recovery turns it red.
- Timeouts: none moved. The specs use the default expect window.

Runs next: a failed document navigation still throws in the test, so
only a lost subresource recovers. A future ticket can retry the
navigation when `page.goto` itself returns `net::ERR_NETWORK_CHANGED`.
