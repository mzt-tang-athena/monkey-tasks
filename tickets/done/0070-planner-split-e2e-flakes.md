---
id: 0070
title: Fix two planner split e2e tests that fail under load
created: 2026-11-07
priority: high
assignee: claude-code
pr: 92
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

Two fix agents measured more the same day. Each ran under load from
the other runs.

- On the bare epic tip `fd6f7a0`, `--repeat-each=10` gave 357 passed
  and 13 failed.
- Before PR #86, "the day list keeps its source toggle above the bottom
  bar" failed 9 of 20 runs. PR #86 made it wait for the settled layout.

Every verifier and fix agent runs this spec. Each flake costs them a
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

- [x] The cause of each failure is named, with a trace.
- [x] `npx playwright test -c e2e/playwright.config.ts e2e/specs/planner-split.spec.ts --repeat-each=20` passes with the machine under load, for example while a second checkout runs `npm run e2e`.

## Outcome

The two tests failed for three causes. Each trace showed the pointer
points and the screen frames, and every failure in a run fit one cause.

1. Month mode drew its first frames at the wrong width. The swipe
   pager in `src/components/swipe-pager.tsx` took the window width as
   its page width until `onLayout` reported. The month sits inside a
   gutter, so the grid first painted larger and lower, then snapped.
   Under load the snap came up to a second late. In the source menu
   test the press landed on the toggle at y 491, and the toggle then
   moved to y 460 while the button was down, so the press slid off
   it. In the drop test the test measured Wednesday 28 before the
   snap, at (226, 406). After the snap that point is below the last
   row, so the drop wrote nothing, and the click at (206, 383) picked
   the day without the row. The hold was long enough: the row lifted.
2. Week mode needed a longer hold than the test gave. The press
   starts on a 50 ms press delay in React Native Web, and the toggle
   then waits 450 ms. The test held for a fixed 650 ms. On the busy
   page the press preview showed about 500 ms after the button went
   down, so the release came before the hold timer ran. The press
   then cycled the source to Focus, and the chooser never opened. The
   toggle was mounted and the press hit it, so the guess that the
   press came before Week mode mounted the toggle was wrong.
3. Day mode on a small phone hit the split jump that ticket 0061
   owns. Until the layout reports, the split paints the toggle at
   y 566, over the bottom bar. Under load the hover took that place
   as stable, and the press then held an overdue row instead.

The fixes:

- The pager sizes its track, its page and its neighbour in percent of
  its own box. The measured width only sets how far a committed swipe
  slides. A new test, "the month grid first paints where it settles",
  reads a cell's box before the first paint. It failed 6 of 6 on the
  epic build and passes on the fix.
- The menu tests hold the toggle until the menu shows, as a user does.
  On a small phone they first wait for the toggle to sit above the
  bottom bar, with the check the toggle test already used.

Counts, `planner-split.spec.ts --repeat-each=20` on 2026-11-08, while
a second full e2e run looped on port 8511 (load 6 to 13 on 4 cores):

| Build | Passed | Failed |
|---|---|---|
| Epic tip `0e61af8`, the spec from the epic | 724 | 16 |
| This branch | 780 | 0 |

The 16 failures were 8 in Week mode, 3 in Month mode and 2 in Day mode
for the source menu, and 3 for the month drop. Each run also skipped
20 swipe preview tests in the reduced motion project, by design.

For ticket 0061: the Day split jump still exists. Under load it lasts
long enough to catch a press, so a user who taps fast can hit the row
under the toggle. The drag code did not cause either failure.
