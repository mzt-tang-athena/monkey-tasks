---
id: 0077
title: A planner row press is lost after a drop on the web
created: 2026-11-10
priority: high
assignee: omp
pr:
depends: [0058, 0061]
---

## Spec

On the web, a press on a planner row can do nothing when the row
re-renders under the finger. The user taps a row's circle after a drop,
and nothing ticks.

Evidence, 2026-11-10. Ticket 0061's test "a tap 100 ms after a drop
still ticks the row" failed once in the `e2e-web` job for PR 101. The
job passed when rerun on the same commit. The owner's report of the
failure says Playwright clicked a stable button, and the row never
ticked.

This is the class the 2026-11-10 amendment to ADR 0046 records.
Gesture handler's web `Pressable` drops a press when the view
re-renders under the finger, and when the view has not been measured
yet. The lists screen left that press for React Native's, because no
pan sits above a list row. The planner cannot: a drag pan must cancel
a row press, so the planner's rows use gesture handler's press. The
lists fix does not apply here.

The drag surface's own tests pass, and the row press is the remaining
gap. It costs the user a tap, and it shows as a flaky test.

## What to do

1. Reproduce first, on the same web build, with the load that shows
   the race. Six concurrent browsers, a drop, then a tap 100 ms later,
   120 presses. Record the lost count on the current head.
2. Trace the lost press to the first place it goes wrong. The two
   suspects the AMENDMENT names are a re-render under the finger and a
   view pressed before its first layout report.
3. Fix it where the surface owns the press, not at a call site. Keep
   the property the surface exists for: a pan that starts on a row
   still cancels the row press.
4. Add the reproduction as a test that fails before the fix and
   passes after. A load-based test is acceptable when its pass is
   deterministic at the fix and its fail is deterministic at the bug.
5. Record the mechanism and the fix as a dated amendment to ADR 0046.

## Acceptance

- [ ] A reproduction loses presses on the current head, with the
      count and the run recorded.
- [ ] After the fix, the same reproduction loses none in 120, run
      twice.
- [ ] `planner-drag.spec.ts` "a tap 100 ms after a drop still ticks
      the row" passes 20 consecutive runs.
- [ ] A pan that starts on a row still opens no editor, and a drop
      leaves no click behind.
- [ ] ADR 0046 carries the dated amendment.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0`, `npx vitest run` and the Playwright suite
      pass.

## Outcome

(filled in before moving to done/)
