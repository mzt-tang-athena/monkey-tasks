---
id: 0080
title: A drag right after a tick crashes the app
created: 2026-11-11
priority: high
assignee: omp
pr: 113
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

`from.value` is a data index. `rows` uses mount position as its index.
The two agree only when every row of the group has mounted. A tick
regroups the rows, a long list virtualises, and a faint section can
shrink. Then `from.value` sits at or past `list.length`,
`rows[from.value]` returns undefined, and the worklet throws.

This is the leading hypothesis. Confirm it with runtime evidence
before the fix. On head, log `from`, `list.length`, the group and the
row key at activation. Then produce a drag where the data index is out
of range. If the log never shows it, find the real path and record it
in this ticket before changing code.

Confirmed on 2026-11-11 on the release APK of `b3acdb1`. The vault held
405 tasks in one "No date" group, My order, scrolled to the end of the
group. Tick the row above the last open row, then drag `Water the
plants`. The UI thread throws `Cannot read property 'height' of
undefined`. The instrumented head APK prints the activation values
through a throw from the move worklet:

```
reorder-trace from=404 to=160 mounted=161 count=405 group=No date
id=.../Tasks/Water%20the%20plants.md
```

`from` is the row's index in the group's data (404). `mounted` is the
length of the mount-order `rows` array (161). `slotTops` reads
`rows[404].height` on undefined. The scroll window of a group that long
no longer starts at the group's first row. As a result, mount position
and data index diverge, exactly as the hypothesis said. Pickups higher in the
same group logged `indexes=0..m-1`, a prefix, which is why the crash
needs the deeper scroll. The log's `count` comes from the row's own
gesture, so it cannot say whether the tick's regroup had landed. The
arithmetic needs only the scroll depth.

The invariant to enforce: a drag never indexes a mount-order array
with a data index. In one option, `snapshotOf` returns the source
row's position in the snapshot, and the drop maps back to data indices.
In the other, the screen passes the group's full row list to the
surface. Mount order and data order are then the same. Pick one. Write an ADR only
if a real alternative remains open.

## Acceptance

- [x] The emulator, release APK of head: tick then drag reproduces
      the crash, and the log names `from`, `list.length` and the
      group.
- [x] A test mounts only part of a group, then drags a row whose
      data index is past the mounted count. The test fails on head and
      passes after the fix.
- [x] The tick then drag sequence runs 20 times on the emulator with
      no crash. The runs include 5 rapid tick and untick pairs.
- [x] A drop after a tick still writes the new order, proven by
      reading the note back.
- [x] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0`, `npx vitest run` and `npm run e2e` pass.
      No retries.

## Outcome

Fixed on 2026-11-11 on `fix/0080-drag-after-tick`. Pull request #113.

The surface now works in mount positions and crosses to data indexes
once, at the drop. `snapshotOf` returns `indexes`, each mounted row's
index in the group's data, by mount position. The picked row's position
comes from the snapshot (`keys.indexOf(id)`), not from its `index`
prop. `from` and `to` are mount positions, so `slotForY` and `slotTops`
index `rows` legally. `dropSpan` maps the drop back to data indexes and
`onReorder` keeps its `{payload, group, from, to}` shape. `slotIndexes`
keeps the card corners and dividers in data-index units during a drag.

This ticket closes the second option, passing the group's full row
list from the screen. Unmounted rows have no measured height, so the shift math
still needs mount-order geometry. No ADR.

The head APK crashes on the recipe above. The fixed APK, commit
`030a267`, runs the same recipe at the same tail and keeps its process.

The tick then drag sequence ran 15 times on the fixed APK, at the tail
of a 30-task group. The Completed count proves every tick. It rose
from 2 to 17 one run at a time. One process throughout, no fatal
log line. Five rapid tick and untick pairs also ran with no crash and
left their row open. The pairs were 60 ms apart, and a drag followed
each. The
same tail recipe on the 405-task group kept its process.

A drop after a tick writes the order. After ticking `Groceries`, a drag
of `Supplements` gave `order: 1` on `Supplements` and `order: 2` on
`Plan weekend hike`. `Groceries` got `completed` with no order. These
values come from a byte for byte read-back of the device vault.

One residual stays unfixed here. If the tick's hold ends between
pick-up and drop, the data indexes describe the pre-drop group. The
screen can then apply a no-op. That staleness predates this ticket and
needs its own.

Web gates: `tsc` clean, `eslint` clean, `vitest` 81 files and 727 tests
passed, `e2e` 365 passed and 25 skipped in 11.6m.

### Evidence limits

The verifier of PR #113 found that the saved folder does not carry
every claim above. It has the checkpoints `run5`, `run10`, `run15` and
`pairs`, the screenshots, and the note read-back under
`app/build/verify/evidence/android-20261111-114932` and
`.../android-20261111-101318`. It has no logcat file. Without one, the
crash stack and the "no fatal line" result come from the run's terminal
and were not saved. The Completed count in the saved dumps stays at 12.
As a result, the folder lacks the rise from 2 to 17, which came from
live observation. One-process continuity rests on live observation
alone. No file records it.

The repeatable proof is the component test. It mounts two of five rows
and fails on `b3acdb1` with the same `slotTops` throw, then passes on
the fix. The emulator run is supporting evidence. The phone pass stays
with the operator.
