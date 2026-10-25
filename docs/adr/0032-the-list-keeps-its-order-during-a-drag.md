# 0032. The list keeps its order during a drag

- **Status:** accepted
- **Date:** 2026-10-25

## Context

Dragging a row to a new place used to reorder the list while the finger
was down. The list moved the cells at once, the rows swapped styles,
and an animation tried to hide the jump. The compensation ran after
the commit, so every crossing blinked, and on the phone the drag felt
laggy.

The obvious approach is to reorder the data on every crossing and
animate the difference. React Native cannot animate a cell that has
moved to a new index, because the cell is a new element at a new
position. Any compensation races the commit.

## Decision

The list keeps its order for the whole drag. Each row animates a
`translateY` to the slot it would take. The divider between rows lives
inside the row, so it travels with the row. The corner radii come from
the slot the row is heading to, not from its index.

The drop reorders the data and zeroes the transforms in the same
commit, so there is no frame between the two.

Only rows whose slot changed start an animation. A crossing that moves
two rows animates two rows.

## Consequences

Nothing reorders under a finger, so nothing can blink. The rows slide
on the native driver, because only a transform moves.

The row that lands first in a section needs the card's top corners and
the row that lands last needs the bottom corners, so the radii depend
on the preview order. Any new row style must read the same preview
order, not the index.

## Alternatives

**Reorder the data on every crossing and compensate with an animation.**
Tried. It blinked on every crossing and needed a longer animation to
hide the jump.

**Reorder once, at the drop, and let the rows snap.** No animation at
all. The drop looked broken and the user could not tell where the row
would land.
