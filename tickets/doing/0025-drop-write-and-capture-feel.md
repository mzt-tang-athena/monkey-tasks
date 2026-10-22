---
id: 0025
title: Drops write, and capture closes before the write
created: 2026-10-22
priority: high
assignee: omp
pr:
depends: [0023]
---

## Spec

Two reports from the phone.

**Drops wrote nothing.** A drag started and the ghost followed, but
releasing over a day, a month cell, or an hour wrote no note.

Zone refs are inline arrows, so React re-invokes them with null on every
render. `DropZoneMap.set(id, null)` deleted the measured rect, so the
rects were wiped after the first move. `hit()` returned null,
`hoveredDay` and `hoverHour` went null, and both drop handlers skip the
write when their hover is null.

Fix: a null ref unregisters the view and keeps the rect. Every pickup
calls `measureAll`, which clears and rebuilds the rects, so a kept rect
cannot outlive a drag.

Also in the drag path:

- `updateTask` becomes a stable callback, so the day drag stops
  rebuilding its gesture object on every move
- the screen root's pointer move and up handlers are attached on web
  only; on native they can fire for a gesture-owned touch
- a move writes the hover ref synchronously with the state, so a drop
  never reads a value one commit behind
- the hour clip is measured directly at pickup, so one stalled measure
  cannot leave it null
- rows key by a stable `id`, not the uri, so the provisional row does
  not remount when its file lands

**Capture felt slow and the keyboard and sheet left at different
speeds.** The sheet waited for the file write before closing, three
separate mechanisms drove the exit, and the input stayed focused until
it unmounted.

Fix: close first, write behind. The tap blurs the input and closes the
sheet in the same frame; the store inserts the row before the write;
the sheet and keyboard share one clock; a failure shows a toast with
Retry and never reopens the sheet.

## Acceptance

- [ ] Dropping on a day in week and month writes the note.
- [ ] Dropping on an hour in the day timeline writes the time.
- [ ] The hover highlight lights during a native drag.
- [ ] Pressing send closes the sheet in the same frame.
- [ ] The sheet and keyboard leave together.
- [ ] The new row is in the list under the closing sheet.
- [ ] A failed write shows a toast with Retry.

## Outcome

(filled in before moving to done/)
