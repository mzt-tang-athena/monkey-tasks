---
id: 0046
title: Swipe pages show their neighbour
created: 2026-10-25
priority: normal
assignee: omp
pr: 66
depends: [0030]
---

## Spec

The swipe from 0030 moves a single page and commits to whatever is
next. That reads as a page sliding into blankness. Nothing peeks over
from the side. At the first or last list, the swipe commits to an
empty page. The planner has the same fault. It slides the whole day,
header included, while the month calendar does not move at all.

One pager serves the list body, the planner day body, and the month
calendar. While a finger travels, the pager mounts the neighbour page
beside the current one. That way the next list or day is visible as it
arrives. A release past the threshold settles on the neighbour; a
shorter release springs back. When no neighbour exists in that
direction the page follows a short rubber band and springs back. As a
result, a swipe never lands on an empty page.

The planner keeps its chrome still: the date strip and the mode
switch never move. The day body (heading, timeline, task list) slides
as one page. The month title and grid slide as one page, and the
picked-day list below stays.

The tick and the capture landing are rebuilt to read at a glance. The
tick fills the circle, scales the check in, and washes the row in
accent. It holds the row in its group for a moment before it moves to
Completed. A capture rises, fades, and carries the same wash as it
lands.

## Acceptance

- [x] Swiping a list shows the neighbouring list sliding in.
- [x] At the first and last list the page rubber-bands and returns.
- [x] The planner day swipe moves the day body, not the date strip.
- [x] The month grid slides between months.
- [x] A tick is visible before the row leaves its group.
- [x] A captured task lands with a rise, a fade, and a wash.
- [x] Reduce motion keeps every end state and drops the travel.

## Outcome

One pager serves all three surfaces. It holds three fixed cells,
previous, current, next. That way the current page keeps its identity
and its scroll while a neighbour slides in. It mounts only the cell the
finger travels toward, and only while it travels. The neighbour is a
still preview with no handlers.

The list body, the planner day body, and the month calendar each pass
their page to the pager. Each keeps its chrome outside it. The day
strip and the mode switch never move. Without a neighbour the page
follows 28 percent of the finger, capped at 48 px, and returns.

A tick now holds its row in its group for 250 ms. Meanwhile the circle
fills, the check scales in, and an accent wash crosses the row. A
captured task rises 12 px, fades in over 220 ms, and carries the same
wash for 600 ms.

Revision after a phone pass. The pager no longer sizes itself. The
current page sets the height. The pager draws the neighbour beside it
out of the flow, so the month calendar renders again. The neighbour
stays mounted through the commit, which removed the day planner's
blink. The previews render a plain row instead of the live one. As a
result, a gesture no longer mounts a list of animated rows. A tick
reads the store's data alone. The optimistic local tick no longer
exists, which removed the double state behind the fast tick, untick,
tick sequence.

Verified in the browser. The neighbouring list peeks and commits. The
first list rubber-bands at 0.28 of the travel and returns. The day body
slides under a still strip. The month title and grid slide while the
pane below stays. The tick holds then regroups. The capture rises and
washes. With reduced motion emulated the page does not travel while the
release still commits.

## Note, 2026-10-26

The phone pass this ticket kept open moves into ticket 0059. The
list's vertical shift on landing and the day and month flicker at the
commit move with it. Both come from the pager's commit, which ADR 0036
and ticket 0059 rebuild. Nothing else remains open here.
