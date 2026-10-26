# 0033. A swipe shows the page beside it

- **Status:** accepted
- **Date:** 2026-10-25

## Context

The first swipe pager moved one page and committed to whatever came
next. Nothing peeked in from the side, so the gesture read as the
content sliding into blankness. At the first or last list the pager
still committed, and the user landed on an empty page with no way back
except another swipe.

The planner had the same shape: the whole day, date strip included,
slid sideways. The month calendar had a swipe detector and no motion at
all.

A paged horizontal list that mounts every list and every day would keep
scroll state and be correct, but it mounts content the user may never
see, and every page owns its own scrolling list.

## Decision

One pager serves the list body, the planner day body, and the month
calendar. It holds three fixed cells: previous, current, next. Only
the cell the finger travels toward is filled, and only while it
travels. The current cell never remounts, so the list keeps its scroll
and its drag machinery.

The neighbour page is a static preview. It shows the same cards and
the same look, but it takes no touches and keeps no state, because it
is only ever seen while moving.

The controller follows the finger from the first horizontal travel and
reports whether a release can commit. A release past the threshold
settles on the neighbour; a shorter one springs back. When no
neighbour exists in that direction, the page follows a short rubber
band and returns, so a swipe never commits to an empty page.

The commit changes the page key. The pager resets its offset in a
layout effect keyed on that key, so the new page paints in place
instead of flashing the old one.

The planner keeps its chrome still. The date strip and the mode switch
never move; the day body (heading, timeline, task list) and the month
title and grid slide.

## Consequences

Every page needs a static twin for the peek. The day preview repeats
the day heading and a simple hour ruler; the month preview repeats the
grid; the list preview repeats the sections. A twin that drifts from
the real page shows only while moving, but it still has to be kept
close.

The current page must stay the same element across a gesture. The
three-cell track exists for that reason, and adding a fourth cell or
reordering the cells would remount the current page.

## Alternatives

**A paged FlatList that mounts every page.** Correct scroll state per
page, and no preview twins. It mounts every list at once, and each
page owns a scrolling list with its own drag sources.

**Slide one page and commit.** The behaviour this replaces. The page
slides into blankness and the ends land on an empty page.

**Rubber-band into the neighbour on release.** The page follows the
finger, then snaps the rest of the way. It was not tried; the preview
cell already reads as arrival, so the settle is short.

## Amendment: 2026-10-25

The neighbour cell is now drawn out of the layout flow, absolutely,
beside the current page, and the pager has no fixed size of its own.
The first version put three cells in a row and let the viewport fill
its parent. That made the pager collapse inside an auto-height parent,
and the month calendar vanished on the phone. Now the current page
alone sets the height, and the pager grows with it.

The neighbour also stays mounted through the commit instead of
disappearing with the old page key. Without it, the settling frame
showed an empty cell, and the day planner blinked. It is dropped one
frame after the commit, once the reset has painted.

## Amendment: 2026-10-25 (second)

The pager takes a `fill` flag. A page that fills its parent (a list
body, a day body) gets `flex: 1`; a page that sets its own height (the
month calendar) grows with its content. One flex setting could not
serve both: with no basis the day body's list collapsed, and with
`flex: 1` the month card collapsed.

The month grid always renders six rows, padding the last week with
blanks. Months need five or six, so without the padding the card's
height changed on commit and the pane below jumped.

The day's neighbour is the real body, inert, not a simplified ruler.
A preview that differs from the page it becomes reads as a flicker at
the commit.

The neighbour is dropped 250 ms after the commit rather than on the
next animation frame, so it cannot vanish from the visible cell while
the offset reset paints.
