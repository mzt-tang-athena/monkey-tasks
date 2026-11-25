# 20261117. Four destinations fit the bottom bar

- **Status:** accepted
- **Date:** 2026-11-17

## Context

The bottom bar holds one destination per tab and the Add action. Lists,
Planner and Journal are there today. Inbox Notes joins them as a fourth
destination. The bar drops the labels under the glyphs and draws the
selected tab at the fill weight (ADR `20261117-phosphor-glyphs`). It
still has to fit a 360 point screen with the Add action beside it.

At the old tab width of 56 points, four destinations take 248 points
with their gaps. The Add pill, the air between the two groups and the
bar padding take about 152 more. The bar would need 400 points.

## Decision

The tab width is 44 points and the gap between tabs is 4 points. Every
destination keeps a 44 point target and an accessible name, so the tab
is exactly its own target. The Add action keeps its text and its 48
point height. The bar stays feature-agnostic and each route fills the
action slot. The tab names are Lists, Planner, Journal and Inbox Notes.

Four destinations take 188 points. The Add pill takes about 88, the
spacer 24, the row gaps 16 and the bar padding 24. The bar needs 340
points of the 360.

We rejected scrolling tabs and targets under 44 points. Both make a
destination harder to find or hit.

## Consequences

Four destinations and Add fit a 360 point screen with room to spare. A
destination must be recognisable from its glyph alone, so a new one
needs a distinct symbol. A screen reader user hears the tab name, not
the glyph. A fifth destination would not fit this row.

The Add action keeps its text label. Capture is the primary action, and
a bare plus is ambiguous with "new".

## Amendment, 2026-11-24: one Add button fits the bar again

The split Add pill arrived on 2026-11-19, when the pane's opener moved
into the bar (ADR `20261111-command-pane`). The operator asked for one
wide Add button in its place on 2026-11-24. The pane opens from a swipe
down on that button now.

The button keeps the height it had and takes the pill's width, about
95pt. It draws the plus and the word "Add", as this record asked.

At 360pt the bar holds four 44pt tabs (188), the button (95) and two
row gaps (16). The bar's padding takes 24 more. The air between the nav
and the button still has about 30pt. The bar needs about 330 of its 360,
so no target drops under 44pt.

The air between the nav and the button carries no gesture. It stays as
space, and the bar's swipes live on the button alone.
