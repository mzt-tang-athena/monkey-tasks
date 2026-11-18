# 20261117. Icon-only bottom bar

- **Status:** accepted
- **Date:** 2026-11-17

## Context

The bottom bar holds a destination per tab and the Add action. Lists,
Planner and Journal are there today. Inbox Notes joins them. Four
destinations plus Add do not fit at 360 points with a label under each
icon. Each label also shrinks the tap targets as we add destinations.

## Decision

A destination shows its symbol only, with no visible label. Every
destination keeps a 44 point target and an accessible name. The Add
action keeps its text. The bar stays feature-agnostic and each route
fills the action slot. The tab names are Lists, Planner, Journal and
Inbox Notes. The tab width is 44 points and the gap is 4 points. The
glyphs come from Phosphor (ADR `20261117-phosphor-glyphs`), and the
selected tab uses the fill weight.

We rejected scrolling tabs and smaller targets. Both make a
destination harder to find or hit.

Four destinations take 188 points. The Add pill takes about 88, the
spacer 24, the row gaps 16 and the bar padding 24. The bar needs 340
of the 360 points.

## Consequences

Four destinations and Add fit a 360 point screen with room to spare.
A destination must be recognisable from its glyph alone, so a new one
needs a distinct symbol. A screen reader user hears the tab name, not
the glyph. The Add action keeps its text label. Capture is the primary action,
and a bare plus is ambiguous with "new".
