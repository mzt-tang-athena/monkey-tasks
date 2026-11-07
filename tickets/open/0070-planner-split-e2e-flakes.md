---
id: 0070
title: Fix two planner split e2e tests that fail under load
created: 2026-11-07
priority: high
assignee:
pr:
depends: []
---

## Spec

On 2026-11-07, `planner-split.spec.ts --repeat-each=10` ran on the
app code at `7c079a2`, with the spec from PR #86 while the machine was busy (load 9 on 4 cores).
367 tests passed and 3 failed. All three failures were in the `motion`
project:

| Test | Runs failed | What failed |
|---|---|---|
| the source menu, on a small phone, opens fully above the bottom bar in Week mode (`planner-split.spec.ts:131`) | 2 of 10 | `boundingBox` on `getByText("Main")` waited 30 s. The source menu never opened. |
| a list row dropped on a month cell takes that day (`planner-split.spec.ts:268`) | 1 of 10 | After the drop and the press on Wednesday 28, the row `Groceries: milk, eggs, oats` never showed. |

Two fix agents measured more the same day, each under load from the
other runs:

- On the bare epic tip `fd6f7a0`, `--repeat-each=10` gave 357 passed
  and 13 failed.
- On the same base, "the day list keeps its source toggle above the
  bottom bar" failed 9 of 20 runs before PR #86 made it wait for the
  settled layout.

Every verifier and fix agent runs this spec, so each flake costs a
rerun and a check that the failure is not theirs.

The traces were in `app/e2e/test-results/` of that run and are gone.
Rerun to get new ones.

A flaky test is a bug. Find the cause in the app or the test. A likely
cause in the first test is a press on the source toggle before Week
mode has mounted it. In the second test, the hold may be too short
under load, so the drop never lifts. Both are guesses. Check them
against a trace.

Ticket 0061 rewrites the drag, so the second test may change there.
Fix this ticket first if the cause is in the test.

## Acceptance

- [ ] The cause of each failure is named, with a trace.
- [ ] `npx playwright test -c e2e/playwright.config.ts e2e/specs/planner-split.spec.ts --repeat-each=20` passes with the machine under load, for example while a second checkout runs `npm run e2e`.

## Outcome

(filled in before moving to done/)
