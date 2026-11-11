---
id: 0086
title: Reorder from the grip only, with screen reader steps
created: 2026-11-11
priority: normal
assignee: omp
pr:
depends: []
---

## Spec

The user asked for two things that are one change.

1. Lists: remove the row overflow menu with Move up, Move down, Move to
   top and Move to bottom
   (`app/src/features/lists/components/task-card-row.tsx:117`). Stop
   the row's hold from starting a drag. Only the six-dot grip starts a
   drag. That frees the horizontal swipe between lists.
2. Accessibility: ticket 0063 added that menu as the non-drag path for
   TalkBack. Do not remove the path. Move it onto the grip. The grip
   reports `adjustable` on native (web maps it to `slider`), with
   increment and decrement actions that move the row one position in
   My order, written through the same `ReorderEvent` a drop writes.
   Reuse the pattern from `app/src/components/motion/split.tsx`. The
   grip's name says what it does, and its value says the position.

Keep the grip a 44pt target. Keep its drag on the UI thread with the
existing press and pan rules. A row swipe must still page, and a
vertical scroll must still scroll.

Trade-off: the row body no longer starts a drag, so a user must find
the grip. It is visible in My order, and its name and value explain it
to TalkBack. Record this change as a dated amendment to the 0063
outcome or to ADR 0040.

## Acceptance

- [ ] No row overflow menu in My order, and no other screen shows
      Move up, Move down, Move to top or Move to bottom.
- [ ] A hold on a row body does not pick it up. A hold on the grip
      does. A horizontal swipe on a row pages.
- [ ] The grip reports `adjustable` with increment and decrement, and
      each step writes the order like a drop, proven by reading the
      note back.
- [ ] The grip is 44 by 44 by layout, and axe reports no serious or
      critical issue.
- [ ] The e2e suite covers the swipe, the grip drag and the steps. The
      TalkBack check is listed as unproven if the emulator cannot
      drive the actions.

## Outcome

(filled in before moving to done/)
