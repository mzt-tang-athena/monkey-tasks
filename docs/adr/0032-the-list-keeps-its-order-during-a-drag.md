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

## Amendment, 2026-10-26: the slide runs on the UI thread

The decision stands. The list keeps its order while a finger is down,
and the corner radii follow the slot a row heads to. The offsets, the
radii and the slot move into shared values (ADR 0036), so a crossing
writes no React state.

The drop is the one place where work crosses from the UI thread to a
React commit. Ticket 0060 tries two ways on a phone and adds a dated
note here with the result.

The first version missed one reset. A drop that read a stale slot equal
to its start skipped the reset, and the rows stayed offset until the
next drag.

## Amendment, 2026-11-10: the drop ships with the index stamp

Ticket 0060 built `createReorderSurface` and moved the lists row
reorder onto it. The decision stands: the list keeps its order while a
finger is down, and the rows, the divider and the corners move as
shared values.

The drop ships with the index stamp, not a new key per moved row.

- Each row's shift and its corner radii count only while its `index`
  prop equals the index it had at pickup.
- The commit that reorders the data changes the index of every row
  that moved. The commit therefore draws those rows at zero, with no
  reset in its frame.
- The shared shifts reset after the commit. A pickup also starts from
  zero, so a cancelled drag cannot leave an offset behind.
- The fallback in the ticket, a new key per moved row
  (`${id}#${dropCount}`), was not needed. `Landing` is unchanged.

The web build carries the evidence. `app/e2e/specs/reorder.spec.ts`
runs in the `motion` and `reduced-motion` projects, with the mouse and
with CDP touch. These cases ended with every moved row at offset 0
within one pixel:

- a drop one slot away, released at once after the crossing;
- a drop at the moment the offset equals the slot;
- a drag away and back, dropped in place;
- a drop from a held row, which also keeps the pager on its page.

A long-pressed row kept the list page in every cell. The component
test `lists-screen.test.tsx` crosses three slots with no screen render
and no task row render. These are the web proofs.

Two native checks stay unproven on this date.

- The Android emulator run with `android-frames.mjs` did not happen,
  so there is no evidence folder.
- The phone pass at 60 Hz and 120 Hz did not happen.

Both acceptance boxes stay unchecked on ticket 0060. A device run
still has to record a fast flick, a drop one slot away and a drop in
place. It must show that no recorded frame draws a moved row at a
stale offset. The emulator does not prove frame rate on real
hardware, so the phone check remains the final word.
