# 0041. Week columns show the chips that fit

- **Status:** accepted
- **Date:** 2026-11-04

## Context

A week column had a minimum height and grew with its chips. The canvas
around the columns has a fixed height (`weekCanvasHeight`), so a column
with 8 tasks ran past it and the canvas cut it off. The cut showed no
sign that tasks were missing. Ticket 0056 (bug 2) asks for the chips
that fit and a "+N more" line that opens the day.

## Decision

Every chip is the same height: two lines of text. A column then fits a
known number of chips, and the code counts them with arithmetic. A
column with more tasks than fit shows fewer chips, so the "+N more" line
has room. A name past two lines ends in an ellipsis. The day view shows
the whole name.

We rejected measuring each chip with `onLayout`. It needs a second
layout pass, and the first frame shows all the chips before the count
arrives. It also leaves nothing for a component test to check, because
jsdom reports no layout.

We rejected a taller canvas or a scroll inside the column. A taller
canvas pushes the list pane down on short phones. A scroll inside a
horizontal scroller fights the horizontal pan.

## Consequences

A column shows 4 chips, or 3 chips and the "+N more" line. A one-line
name sits in a chip with room for two. The week looks more even, and it
shows fewer tasks than before on a column with short names. If the
fixed height proves too coarse, a later ticket can measure the chips.
`weekChipCount` is the one place to change.
