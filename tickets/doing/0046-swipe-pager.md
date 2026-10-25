---
id: 0046
title: Swipe pages show their neighbour
created: 2026-10-25
priority: normal
assignee: omp
pr:
depends: [0030]
---

## Spec

The swipe from 0030 moves a single page and commits to whatever is
next. That reads as a page sliding into blankness: nothing peeks over
from the side, and at the first or last list the swipe commits to an
empty page. The planner has the same fault, and it slides the whole
day, header included, while the month calendar does not move at all.

One pager serves the list body, the planner day body, and the month
calendar. While a finger travels, the pager mounts the neighbour page
beside the current one, so the next list or day is visible as it
arrives. A release past the threshold settles on the neighbour; a
shorter release springs back. When no neighbour exists in that
direction the page follows a short rubber band and springs back, so a
swipe never lands on an empty page.

The planner keeps its chrome still: the date strip and the mode
switch never move. The day body (heading, timeline, task list) slides
as one page; the month title and grid slide as one page, and the
picked-day list below stays.

The tick and the capture landing are rebuilt to read at a glance. The
tick fills the circle, scales the check in, washes the row in accent,
and holds the row in its group for a moment before it moves to
Completed. A capture rises, fades, and carries the same wash as it
lands.

## Acceptance

- [ ] Swiping a list shows the neighbouring list sliding in.
- [ ] At the first and last list the page rubber-bands and returns.
- [ ] The planner day swipe moves the day body, not the date strip.
- [ ] The month grid slides between months.
- [ ] A tick is visible before the row leaves its group.
- [ ] A captured task lands with a rise, a fade, and a wash.
- [ ] Reduce motion keeps every end state and drops the travel.

## Outcome

(filled in before moving to done/)
