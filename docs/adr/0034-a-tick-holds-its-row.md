# 0034. A tick holds its row for a moment

- **Status:** accepted
- **Date:** 2026-10-25

## Context

Ticking a task writes the note and regroups the list in the same
frame. A done task leaves its date group and moves to Completed, which
usually sits below the fold. So the row vanished under the finger and
the tick effect never ran: the only visible change was a row
disappearing.

The store is optimistic on purpose (ADR 0017). The write is immediate
and the list is the truth. Any effect on the row has to happen before
the regroup, or on a row that no longer exists.

## Decision

The lists screen holds a ticked row in the group it was in for 250 ms.
While the hold is active the row keeps its place, its index, and its
identity, and the circle animates there. After the hold the row moves
to Completed as the data already says it should.

The hold lives in the screen, not in the store: the data is written at
once and the grouping is what waits. A second tick on the same row, or
a change from the vault, drops the hold early.

## Consequences

For a quarter second the screen shows a grouping the data does not
agree with. The row is already done, so the difference is only where
it sits.

The screen owns a small piece of grouping state that the store does
not know about. Every consumer of the sections has to go through the
same memo, or the held row would appear twice.

## Alternatives

**Animate the row where it lands.** The row is a new element in the
Completed section, so there is nothing to animate from. The old row is
already gone.

**Keep the row in place until the user leaves the screen.** The list
would stop matching the notes, and a refresh would break it.

**No hold, only a flash on the circle.** The circle can animate in
place, but the row still vanishes in the same frame, so the effect
reads as a flicker.
