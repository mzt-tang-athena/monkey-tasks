# 0030. Task groups are cards

- **Status:** accepted
- **Date:** 2026-10-25

## Context

The Lists screen drew each date group as a label over flush rows, with
a hairline between rows that ran the full page width. On the phone it
read as one long table: with four to six groups, the label was the only
separation.

Todoist keeps the flat rows and insets the dividers to the text. Google
Tasks and TickTick put each group in a rounded card.

## Decision

Each group is one card: the surface color, a hairline border, the shared
radius, the label above, and dividers inset to the text. A group with
one item is a full card. The card carries no shadow; shadows stay for
floating surfaces, the sheet and the toast.

## Consequences

A group now has an edge, so a glance finds the boundary without reading
the label. The screen gains one border and two radii per group, and no
height of its own: the row keeps its padding. The rows themselves got
roomier in the same pass, with 12pt of vertical padding, 16pt of
horizontal padding, a 24pt circle and 24pt between groups.

The card is built from its rows, so the section list keeps its
virtualization and its sticky header. The cost is that a card cannot
have a footer or a header inside it without moving the group out of the
section list.
