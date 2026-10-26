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

- [x] Swiping a list shows the neighbouring list sliding in.
- [x] At the first and last list the page rubber-bands and returns.
- [x] The planner day swipe moves the day body, not the date strip.
- [x] The month grid slides between months.
- [x] A tick is visible before the row leaves its group.
- [x] A captured task lands with a rise, a fade, and a wash.
- [x] Reduce motion keeps every end state and drops the travel.

## Outcome

One pager serves all three surfaces. It holds three fixed cells,
previous, current, next, so the current page keeps its identity and
its scroll while a neighbour slides in. Only the cell the finger
travels toward is mounted, and only while it travels; the neighbour is
a still preview with no handlers.

The list body, the planner day body, and the month calendar each pass
their page to the pager and keep their chrome outside it. The day
strip and the mode switch never move. Without a neighbour the page
follows 28 percent of the finger, capped at 48 px, and returns.

A tick now holds its row in its group for 250 ms while the circle
fills, the check scales in, and an accent wash crosses the row. A
captured task rises 12 px, fades in over 220 ms, and carries the same
wash for 600 ms.

Revision after a phone pass. The pager no longer sizes itself: the
current page sets the height, and the neighbour is drawn beside it out
of the flow, so the month calendar renders again. The neighbour stays
mounted through the commit, which removed the day planner's blink. The
previews render a plain row instead of the live one, so a gesture no
longer mounts a list of animated rows. A tick reads the store's data
alone: the optimistic local tick is gone, which removed the double
state behind the fast tick, untick, tick sequence.

Verified in the browser: the neighbouring list peeks and commits, the
first list rubber-bands at 0.28 of the travel and returns, the day body
slides under a still strip, the month title and grid slide while the
pane below stays, the tick holds then regroups, the capture rises and
washes, and with reduced motion emulated the page does not travel while
the release still commits.
