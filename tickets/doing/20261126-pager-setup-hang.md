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

## Findings

Not reproduced on 2026-11-26. Rates, two workers, CPU loaded:

- Full pagers, 4 busy loops on 4 cores: 8 runs, 0 hangs.
- Full pagers, 10 busy loops, load 15: 2 runs, 0 hangs.
- One unloaded full run: 0 hangs.
- Setup only (goto, Main, sort, Due), 8 busy loops: 300 runs
  (150 per project), 0 hangs.
- About 1,200 setups in all, 0 hangs.

What the two kept records say:

- CI on PR #244: the sort click started and never finished.
- A lane: stuck at "waiting for element to be visible, enabled and
  stable" with the button resolved and visible.
- Both need the page to answer. The stable check and the click ack
  both ride on a frame. The Main tab click had passed already.
- That fits a stalled page or runner.
- A toolbar still settling would not hold a static button
  unstable for 30 s.
- I infer this and have not shown it. No lane kept a hang trace.

Next hang: keep the trace and read the page's last frame time. The
loop scripts are in the lane's evidence folder.

## Outcome

(filled in before moving to done/)
