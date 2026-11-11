---
id: 0080
title: A drag right after a tick crashes the app
created: 2026-11-11
priority: high
assignee:
pr:
depends: []
---

## Spec

In My order, tick a task and start a drag within about a second. The
app crashes with `CppException: Cannot read property 'height' of
undefined`. The exception comes from the UI thread, so the JS error
alert does not show. Ticket 0081 covers reporting; this ticket fixes
the crash.

Where it lives now, on `b3acdb1`:

- `app/src/components/motion/reorder.tsx:119` `snapshotOf` builds
  `rows` from the mounted rows of the group only, in mount order.
- `reorder.tsx:494` `from.set(index)` takes the row's render prop
  `index`, which is its index in the section data.
- `reorder.tsx:530` builds `order` as mount positions 0 to
  `list.length - 1`, inserts `from.value`, and calls `slotTops`.
- `app/src/lib/motion/drag-math.ts:57` reads `rows[index].height`.

`from.value` is a data index. `rows` is indexed by mount position. The
two agree only when every row of the group is mounted. A tick regroups
the rows, a long list is virtualised, and a faint section can shrink.
Then `from.value` sits at or past `list.length`, `rows[from.value]` is
undefined, and the worklet throws.

This is the leading hypothesis. Confirm it with runtime evidence
before the fix. On head, log `from`, `list.length`, the group and the
row key at activation, and produce a drag where the data index is out
of range. If the log never shows it, find the real path and record it
in this ticket before changing code.

The invariant to enforce: a drag never indexes a mount-order array
with a data index. Either `snapshotOf` returns the source row's
position in the snapshot and the drop maps back to data indices, or
the surface receives the group's full row list from the screen so
mount order and data order are the same. Pick one. Write an ADR only
if a real alternative remains open.

## Acceptance

- [ ] The emulator, release APK of head: tick then drag reproduces
      the crash, and the log names `from`, `list.length` and the
      group.
- [ ] A test that mounts only part of a group, then drags a row whose
      data index is past the mounted count, fails on head and passes
      after the fix.
- [ ] The tick then drag sequence runs 20 times on the emulator,
      including 5 rapid tick and untick pairs, with no crash.
- [ ] A drop after a tick still writes the new order, proven by
      reading the note back.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0`, `npx vitest run` and `npm run e2e` pass.
      No retries.

## Outcome

(filled in before moving to done/)
