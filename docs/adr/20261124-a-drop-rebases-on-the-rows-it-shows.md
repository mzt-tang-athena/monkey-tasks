# A drop rebases on the rows it shows

- **Status:** accepted
- **Date:** 2026-11-24

## Context

The Lists screen reorders a group by data indexes. Pick-up reads the
mounted rows and each one's index in the group's data then. The drop
turns the finger's slot back into a pair of those indexes.

A row can leave the group between pick-up and drop. A tick's hold ends,
and its row moves to Completed. A grip step moves a row one place. The
indexes from pick-up then name other rows.

The drop can then write a wrong order. We saw it with five rows. The
user ticked the second row, then dragged the fourth to the top. The drop
wrote the fifth row first.

## Decision

At the drop, the surface reads the group as it stands. It maps the
pickup keys to their indexes now. The picked row keeps its own key.
The row below the drop's gap keeps its own key too. A row that left
the group moves nobody.

The drop cancels when the picked row left the group. It also cancels
when the rows that remain no longer stand in their pickup order. A
cancel springs the row back and writes nothing.

We kept the pickup indexes for the slot math. Only the drop reads the
group again.

## Consequences

A tick under a held drag keeps the drag the user made. That is the
common case. A tick holds its row for 320 ms, and a drag starts in
that window.

A step under a held drag cancels. The old indexes may name a passable
order there. The corners and shifts still come from the pickup layout.
A rebase could then land where the user saw nothing move.

The drop reads the item registry on the JS side, where the rows change.
The pickup still takes its snapshot in a worklet. On the emulator that
copy lagged a regroup by a few frames, in one run in six. The drop reads
the other copy now. A stalled frame can no longer stale it.

The alternative was to cancel on any change to the group. That is the
smaller change. It also throws away a drag the user can still see. The
tick case is the one this exists for.
