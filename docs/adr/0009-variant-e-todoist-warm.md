# 0009. Variant E todoist warm direction

- **Status:** proposed
- **Date:** 2026-10-20

## Context

Round 2 of the design exploration (ticket 0016) combines round-1
feedback into one variant per agent. Variant E is the densest one: it
keeps the warm paper the user preferred, but trades B's cream and
sage for a crisp near-white paper and a single Todoist-family
red-orange accent. The user wanted the utilitarian feel of
"reddish-orange with white" and warned that Variant A's blue read as
"too googly".

## Decision

Variant E uses paper `#FBFAF8` (crisp white with a faint warm cast),
ink `#3A3529`, and one accent, `#DC4C3E`, with plain white for text
and icons on accent fills. We kept the red-orange close to Todoist's
own instead of damping it further, because the user named that exact
feel as the target; the warmth comes from the paper and the grays.
Danger is a deeper brick, `#9C3A24`, so overdue reads darker and more
serious than the accent.

Typography carries the layout: plain uppercase group headers, no
cards, hairline-separated 44pt rows on a 4pt working scale. The
capture affordance is a persistent inline composer docked above the
bottom bar; it reads as a text field, and focusing it expands it in
place. There is no round add button.

The Planner date header keeps a modest serif (Georgia, 24pt) as the
one warm gesture. Todoist itself is all-sans, and we considered going
all-sans here too. We kept the serif because the user singled out B's
serif date header as something to keep, and one small gesture does
not crowd the dense layout.

The Planner Day spread adds an hour-ruler timeline (6 AM to 10 PM,
56pt slots) with timed tasks set at their positions and a now line,
plus an unscheduled tray docked below it: undated tasks wait there to
be dragged onto the timeline (ticket 0017 covers the real drag).

## Consequences

The palette is one accent plus warm neutrals, so new screens have no
color decisions to make. The ruler's absolute positioning is the
first layout in the app that needs duration data; without end times,
every block is one slot tall. If the user merges a different variant,
only `tokens.ts` carries the palette, so a merge is cheap.
