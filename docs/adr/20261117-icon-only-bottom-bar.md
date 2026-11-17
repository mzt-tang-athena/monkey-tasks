# 20261117. Icon-only bottom bar

- **Status:** accepted
- **Date:** 2026-11-17

## Context

The bottom bar holds a destination per tab and the Add action. Lists
and Planner are there today. Journal and Inbox Notes join them. Four
destinations plus Add do not fit at 360 points with a label under each
icon. The labels also shrink the tap targets as destinations are added.

## Decision

A destination shows its symbol only, with no visible label. Every
destination keeps a 44 point target and an accessible name. The Add
action keeps its text. The bar stays feature-agnostic and each route
fills the action slot. The tab names are Lists, Planner, Journal and
Inbox Notes. The tab width is 48 points and the gap between tabs is 4
points, so four destinations and Add fit at 360 points.

We rejected scrolling tabs and smaller targets. Both make a
destination harder to find or hit.

## Consequences

Four destinations and Add fit a 360 point screen with room to spare.
A destination must be recognisable from its glyph alone, so a new one
needs a distinct symbol. A screen reader user hears the tab name, not
the glyph. The Add action keeps a text label because capture is the
primary action and a bare plus is ambiguous with "new".
