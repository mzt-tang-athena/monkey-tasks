---
title: The planner's dates follow the swipe
created: 2026-11-20
priority: normal
assignee:
pr:
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

- [ ] On Day, the selected mark moves with the finger mid-swipe.
- [ ] On Week and Month, the dates move with the finger mid-swipe.
- [ ] A cancelled swipe leaves the strip in place.
- [ ] No re-render per frame, shown the way #169 showed it.
- [ ] Reduced motion moves the strip with no slide.
- [ ] Emulator frames show the strip mid-swipe.

## Outcome

(filled in before moving to done/)
