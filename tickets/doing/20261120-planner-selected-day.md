---
title: The day planner's strip marks the first day after a swipe
created: 2026-11-20
priority: high
assignee: omp
pr:
depends: []
---

## Spec

The operator found this on the phone on 2026-11-20. The build was
1.2.0, installed over 1.0.0.

His words cover a swipe to different days on the Day planner.
"The 'selected' day at the top always stays as the 1 day in the column.
Instead of its previous behaviour."

1.1.0 behaved right, in the report. 1.2.0 does not.

The day planner's period strip sits above the mode switch. It marks
the shown day with a taller accent cell. A swipe on the day body
commits a new day through the route. The strip's mark should move to
that day's cell.

These commits between `v1.1.0` and `v1.2.0` touch the planner or a
pager: #169, #173, #174, #177, #178, #181.

## Acceptance

- [ ] A test fails before the fix and passes after, at the level a user
      sees it.
- [ ] On the emulator with a release APK, a swipe marks the right day,
      both ways and across a week boundary.
- [ ] `CHANGELOG.md` carries the fix under a new 1.2.1 heading.
- [ ] The strip marks the right day with the week starting on Monday
      and on Sunday.

## Outcome

(filled in before moving to done/)
