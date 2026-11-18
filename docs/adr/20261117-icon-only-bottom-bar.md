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
