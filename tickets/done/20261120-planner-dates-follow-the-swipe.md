---
title: The planner's dates follow the swipe
created: 2026-11-20
priority: normal
assignee: omp
pr: 197
depends: []
---

## Spec

The operator's note from the 1.2.0 phone check on 2026-11-20. The list
tab underline now follows the finger during a swipe (#169). It feels
good. The dates at the top of the planner should do the same across
days, weeks and months.

Today the period strip in `planner-header.tsx` jumps to the new day,
week or month once the swipe lands. Make it track the pager's live
position instead:

- Day: the selected-day mark slides between days with the finger.
- Week and Month: the strip's dates move with the swipe.
- A swipe that springs back leaves the strip in place.

Follow the shape #169 used for the tab underline. It reads the pager
position on the UI thread and does not re-render per frame.

This builds on the fix for the selected-day regression, which a lane
is fixing now as `20261120-planner-selected-day`. Start after it merges.

## Acceptance

- [x] On Day, the selected mark moves with the finger mid-swipe.
- [x] On Week and Month, the strip moves with the finger mid-swipe.
- [x] A cancelled swipe leaves the strip in place.
- [x] No re-render per frame, the shape #169 used.
- [x] Reduced motion moves the strip with no slide.
- [x] Emulator frames show the strip mid-swipe.

## Outcome

The strip painted its fill inside the selected cell, so the fill moved
only when the pager committed. It now paints one `PeriodMark` over
measured cells and reads the pager's live page in a worklet (ADR 0046).
The link lends the page the pager stands on, so the mark's cell is true
while a render travels.

Day rides inside today's window. Past either end the seven-day window
follows the shown day, as `railStartIdx` has since 1.0. The mark holds
and the dates slide under it. That is the operator's choice of
2026-11-20 from the selected-day ticket. Today keeps its own tint.

Week and Month ride the same way, and their dates hold. The mark's
travel is what meets that acceptance line. Dates that slide under a
standing mark need a window per page. That drops the current period's
tint out of the strip after one swipe. Whether the tint is worth that
trade is the operator's call.

The mark is opaque, and it carries a clipped copy of the row's labels
in the accent ink. The label under it reads lit wherever it lands.
Every cell is 52 tall, so a label no longer rises 4 px when the
selection reaches it. Reduced motion needed no path of its own.

Proof: `app/e2e/specs/planner-period.spec.ts` holds half a swipe in
each mode, and reads the mark between two cells. It covers:

- A cancelled swipe.
- A month boundary.
- Weeks that start on Sunday.
- A month five months out.
- A landing with no step back.
- A day far from today.
Emulator frames of a day and a week swipe mid-gesture are in
`app/build/verify/evidence/android-20261120-060338/`.
