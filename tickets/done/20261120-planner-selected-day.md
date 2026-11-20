---
title: The day planner's strip marks the first day after a swipe
created: 2026-11-20
priority: high
assignee: omp
pr: 193
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

The report came from the operator's own steps. No 1.2.0 change caused
it. The strip follows a lazy-follow rule, unchanged since `v1.0.0`.

`railStartIdx` in `model.ts` anchors the seven-day window on today.
When the shown day sits far in the past, the window starts at that
day. The mark is then always the first cell, and the seven dates slide
under it. Far in the future, the same rule pins the mark to the last
cell.

The operator's steps put the shown day far in the past. He had moved
to a month far from today, then swiped days. He confirmed on
2026-11-20 that his own steps caused it.

What each run showed, driving `/planner?mode=day&day=<far>`:

- 1.2.0, `96a8248`, web preview: a day far in the past marks the
  first cell on every swipe. A day far ahead marks the last cell.
- 1.1.0, `234dfe1`, web preview: the same output, line for line.
- Emulator, 1.2.0 JavaScript: Month back to Jul 2026, then Day. The
  heading follows each swipe (Wed 1, Tue 30, Mon 29). The mark stays
  on the first cell.

Evidence: `app/build/verify/evidence/20261120-040729/` for the web
runs, and `app/build/verify/evidence/android-20261120-033149/` for the
emulator, whose `far-day-back.png` shows the mark on Mon 29.

No code change and no changelog heading. The idea of a mark that
slides with the finger is ticket
`20261120-planner-dates-follow-the-swipe`.
