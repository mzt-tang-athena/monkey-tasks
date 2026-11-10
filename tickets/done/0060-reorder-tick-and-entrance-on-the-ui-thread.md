---
id: 0060
title: Reorder, tick hold and capture entrance run on the UI thread
created: 2026-10-26
priority: high
assignee: omp
pr: 103
depends: [0058, 0059]
---

## Spec

Epic 0047, phase 4. ADR 0036, its amendments to ADR 0032 and ADR 0034,
and ADR 0046 decide this. This ticket builds `createReorderSurface` on
0058's engine and moves the row reorder onto it. It ends the tick hold
from the tick's animation, and replaces the 90 second freshness window
with the landed mark. Paths are on `epic/0047-rebuild` at commit
`745976f`, under `app/src`. Line numbers in `lib/motion.ts` refer to
the file before 0058 moved it to `lib/motion/legacy.ts`.

### Design, 2026-11-08

This spec follows the 2026-11-08 design package for phase 4. ADR 0046
records it. What matters here:

- The lists screen writes no gesture code. It renders
  `ListReorder.Root`, `ListReorder.Item` and `ListReorder.Grip`, and
  gets one `onReorder({ payload, group, from, to })` only when the row
  moved.
- The old step 1 offered three ways to make the drop land with no
  blink. The design picks the index stamp inside `Item`. A row's shift
  counts only while its `index` prop equals the index it had at pickup.
  The commit that reorders the data changes the moved rows' indexes, so
  the commit itself carries zero shift. Nothing resets in the commit's
  frame. A new key per moved row stays the fallback, inside `Item`
  only.
- The tick runs on `useProgress`, the one clock that React drives. Its
  `onSettled` ends the hold. No timer remains.
- The owner chose one shared hold tint and shake look. The reorder's
  lifted look is the surface's own, the same as the Planner's.

### What breaks today

| Bug | Today | What the user sees |
|---|---|---|
| V6 | Fixed by 0055: sections key on their title (`features/lists/lib/list-sections.ts:31`), and `features/lists/lists-screen.test.tsx:144-156` checks the remount. This ticket keeps that test green through the port. | A group that empties remounts every row below it. |
| V7 | `lib/motion.ts:51-83` and `components/task-row.tsx:52-60,91-103,197` test freshness on every mount. Remounts come from the move to Completed, from the id change on refetch, from the reorder ghost (`features/lists/components/reorder-ghost.tsx:39`) and from planner pills on a day change (`features/planner/components/drag.tsx:155`). | A task captured in the last 90 seconds fades and washes in again. |
| V8 | `features/lists/hooks/use-row-reorder.ts:173-247`, `241-243` and `279-283`, with `features/lists/components/reorder-row.tsx:124-127,167-170`. A drop with a stale `to` skips the reset. | A fast flick lands a slot off, or the rows stay overlapped. |
| V9 | `features/lists/hooks/use-tick-hold.ts:13,31-39` and `lists-screen.tsx:114`. One hold in state and a 250 ms timer. A second tick replaces the first. | The row below jumps above the second ticked row. |
| V10 | `lists-screen.tsx:89-92,111,119` and `src/hooks/use-press-guard.ts`. After a drop, the guard swallows the next tap. | A tick right after a drop does nothing. |
| J2 | `use-row-reorder.ts:187-188,213-227` and `lists-screen.tsx:169-181`. Each move sets the ghost on the JS thread, and each crossing calls `setLifted`. 0055 fixed the memo half. | The ghost lags, and rows render on each crossing. |
| J3 | `lib/motion.ts:11-46`. Each caller of `useReduceMotion` subscribes to `AccessibilityInfo`. Native starts at `false` and resolves later. | Slower mounts, and the first frames animate with reduce motion on. |
| L1 | `use-row-reorder.ts:92-98,213-226`. The row slides ignore reduce motion. | Rows slide with reduce motion on. |
| L3 | `use-row-reorder.ts:188-209` and `features/lists/lib/reorder.ts:48-61`: `to` indexes the sorted rects but is used as an items index. `use-row-reorder.ts:136-153` measures every row async and lifts only in the grabbed row's callback. 0055 fixed the timer and ref leaks. | A long section can pick the wrong slot, and a quick tap can leave a row lifted. |

### What the surfaces make impossible, and what stays here

By construction, once the lists render `ListReorder` and `Landing`:

- V8. `from` and `to` come from the UI thread in the crossing. Shifts
  carry the index stamp, so a commit carries zero. A drop in place
  returns on the UI thread. The drop compares indexes, never positions.
- V10. No guard exists. The row's press targets are gesture handler's
  `Pressable`, and the drag's activation cancels them.
- J2. The ghost, the shifts, the radii and the divider are shared
  values. A crossing renders nothing.
- J3. Lint bans `AccessibilityInfo` motion reads. Every animation passes
  `ReduceMotion.System`.
- L1, the slides. The surface's slides pass `ReduceMotion.System`.
- L3. No hold timer. Only mounted rows are measured, at pickup, on the
  UI thread. The bridge's generation guard drops a stale measure.
- V7, the surface half. `Landing` takes the mark once, in a state
  initializer, so a remount never finds it.

This ticket still owns:

- V6. Keep the remount test green.
- V7, the feature half. The capture mutation calls `markLanded`. The
  ghost renders `PreviewRow`, which has no `Landing`.
- V9. The placement of several holds in `features/lists/lib/tick-hold.ts`.

### Step 1: build `createReorderSurface`

Build `src/components/motion/reorder.tsx` with the signature from 0058.

- `Item` holds rows with `hold: "row"` (300 ms, `touchAction: 'pan-y'`).
  `Grip` holds with `hold: "grip"` (0 ms, `touchAction: 'none'`). Both
  come from the 0058 hold table.
- At pickup, the owning row measures its group's mounted rows once with
  `measure()`, in page coordinates, and takes a snapshot of each row's
  index, top and height. Slot math uses `slotForY` and `slotTops` from
  `lib/motion/drag-math` over that snapshot.
- A row's shift is `snapshot[id]?.index === props.index ? shift : 0`.
- `Item` owns the card corners and the divider in a reorderable list.
  It replaces `CardGroupRow` in `task-card-row.tsx`. The radii follow
  the slot a row heads to (ADR 0032), from `cardPosition` in
  `lib/motion/drag-math`.
- The ghost renders through `renderGhost` in the `dragGhost` layer.
- `onReorder` runs once per drop, and only when `from !== to`.

### Step 2: check the drop for a blink

Run the reorder on the Android emulator with the `verify-monkey-tasks`
skill's Android path. Record a fast flick, a drop one slot away and a
drop in place with the frames helper (`android-frames.mjs`). No frame
may show a moved row at a stale offset.

If a frame blinks, replace the index stamp inside `Item` with a new key
for each moved row at the drop (`${id}#${dropCount}`), as
react-native-reorderable-list does (`createCellKey` and `markCells` in
[ReorderableListCore.tsx](https://github.com/omahili/react-native-reorderable-list/blob/291621a050e5fb176984a2270460d5caaf099085/src/components/ReorderableListCore.tsx)).
`Landing` stops the entrance on that remount. No call site changes.

The skill says the emulator does not prove frame rate on real
hardware. So repeat the check on the phone at 60 Hz and at 120 Hz.
Add a dated note to ADR 0032 with the result, the build, and the rates
it ran on.

### Step 3: the reorder on the lists screen

- Add `features/lists/lib/list-reorder.ts`:
  `export const ListReorder = createReorderSurface<TaskItem>();`.
- `features/lists/lists-screen.tsx` wraps the `SectionList` in
  `ListReorder.Root` with `onReorder={moveTask}` and
  `renderGhost={(task) => <PreviewRow task={task} />}`.
- `features/lists/components/task-card-row.tsx` renders
  `ListReorder.Item` with `payload={task}`, `id={task.uri}`, `group`,
  `index`, `count` and `disabled={!canDrag}`. Inside it, `Landing` wraps
  `TaskRow`, and `TaskRow` gets
  `grip={canDrag ? <ListReorder.Grip testID={`reorder-grip:${task.name}`} /> : null}`.
- `moveTask` writes through `use-reorder-section`
  (`src/stores/tasks/mutations/use-reorder-section.ts`). The rendered
  order must change in the same tick, which the optimistic list does
  (ADR 0017). A late write still ends right, but its rows slide back
  and then jump.
- Delete `use-row-reorder.ts`, `reorder-row.tsx` and `reorder-ghost.tsx`,
  and the web reorder handlers that 0059 moved off the pager host onto
  a plain `View`.
  Keep `reorderItems` and `moveItem` in `features/lists/lib/reorder.ts`.
  Delete `layoutOrder`, which `slotTops` replaced.
- Remove the drop arm of `use-press-guard`. 0059 removed the swipe arm.
  Then run `git grep -n -e usePressGuard -e makePressGuard -- app/src`.
  If it finds no caller outside `src/hooks/use-press-guard.ts` and its
  test, delete both. If a caller is left, keep the file and name the
  caller in the Outcome.

### Step 4: the tick hold

- Each tick holds its own row, and several holds can run at once. A
  held row keeps its place among the rows that stood around it at tick
  time. Extend the pure placement in `features/lists/lib/tick-hold.ts`
  and its tests to cover two and three holds. A second tick never moves
  another row.
- `TaskRow` (`src/components/task-row.tsx`) plays the tick on
  `useProgress(done, { ms: motion.ms.tickWash, onSettled })`. The circle
  fills, the check scales in, and the wash crosses the row in 320 ms.
  `onSettled(1)` calls `onTickSettled(task)`, which ends that row's
  hold. Unmount runs `onSettled` too, so the hold ends.
- An untick during the hold drops that hold at once. The reversal
  supersedes the run, so its `onSettled(1)` never runs.
- `use-tick-hold.ts` keeps a map of holds and no timer. Delete
  `tickHoldMs`.

### Step 5: the capture entrance

- `src/stores/tasks/mutations/use-capture-task.ts` calls
  `markLanded(id)` from `@/lib/motion/entrances` when it inserts the
  row, with the id the row first mounts under.
- `Landing` runs the `landing` entering animation (220 ms) and the wash
  (600 ms) only for a row that finds the mark. The row that remounts
  under its file uri after a refetch finds nothing.
- Delete both copies of `freshMs` and the entrance code in `TaskRow`.
  Delete `useRise` from `lib/motion/legacy.ts` if 0061 already removed
  the planner pill's use. Otherwise 0061 deletes it.
- `TaskRow` drops `useReduceMotion`. Remove this ticket's files from the
  0058 lint allowlist. That includes `lists-screen.tsx`, which 0059
  left there.
  `task-card-row.test.tsx` builds an `Animated.Value` for the
  `CardGroupRow` shift. Rewrite it onto `ListReorder.Item`.

### Tests first

Each bug gets a failing test before its fix. The Playwright suite in
`app/e2e` runs each scenario with the mouse and with CDP touch. Rows
and grips use the test ids `task-row:<name>` and `reorder-grip:<name>`.
A hold uses `holdDrag` from `app/e2e/gestures.ts`, which pauses the
clock and calls `page.clock.runFor` past the hold (0058). Pin time with
`page.clock.install`, never `setFixedTime`. Reduce motion scenarios run
in the `reduced-motion` project.

| Scenario | Proves |
|---|---|
| `expectTouchAction` reads `pan-y` on a row and `none` on `reorder-grip:<name>`. | the hold table |
| Tick the last task of a group. The DOM nodes of the rows below stay connected. | V6 |
| Capture a task, then within 90 seconds tick it, drag it in My order, and switch tabs and back. Each mounted copy shows opacity 1 on its first frame. | V7 |
| In My order, drag a row one slot and release at once after the crossing. It lands in the slot the gap showed, and every other row rests at offset 0. Drag away and back, then drop in place. All offsets read 0. | V8 |
| In My order, drag a row onto the next slot and release with no further move once its offset equals that slot. It reorders, and every offset reads 0. | the index rule |
| Tick two adjacent rows 100 ms apart, top first. Sampled each frame for 400 ms, the third row never rises above the second. | V9 |
| Drop a row, then tick another row 100 ms later. The tick lands. Drop a row on its own place. Nothing toggles and no editor opens. | V10 |
| Tick a row. At 200 ms it sits in its group, and at 600 ms it sits in Completed. | hold |
| Navigate away 100 ms after a press on a row, then come back. The console shows no error and no row hangs lifted. | L3 |
| In the `reduced-motion` project, a drag moves rows straight to their slots, a tick regroups at once, and a capture lands at rest. | L1, J3 |

A jsdom component test covers J2. A drag that crosses three slots
renders the lists screen no times between pickup and drop, and no
`TaskRow` renders. This adds to the 0055 tests. A second component test
covers the refetch id change with the 0051 vault adapter fake. The row
that remounts under its file uri runs no entrance.

Only the emulator and the phone show V8's stale window and J3's late
start on native.

## Acceptance

- [x] Each scenario above has a failing test before its fix, and all
      pass after, with the mouse and with touch.
- [x] `src/components/motion/reorder.tsx` exists with the 0058
      signature, and the lists screen reorders only through
      `ListReorder`.
- [ ] ADR 0032 carries a dated note naming the drop that shipped (the
      index stamp, or a new key per moved row), with the emulator
      evidence folder and the phone rates it ran on.
- [x] The reorder, the tick hold and the entrance use only
      `src/components/motion` and `useProgress`. Lint passes with this
      ticket's files out of the allowlist.
- [x] `use-row-reorder.ts`, `reorder-row.tsx`, `reorder-ghost.tsx`,
      `freshMs` and the tick hold timer are gone. `use-press-guard.ts`
      is gone, or the Outcome names the caller that keeps it.
- [ ] Emulator, reduce motion off: a long press lift, a grip drag, a
      fast flick, a drop in place and a scroll that starts on a row all
      behave. No recorded frame blinks at the drop, and no tap after a
      drop goes missing.
- [ ] Phone: tick three rows in quick order. Each fills, washes and
      then moves to Completed, and no other row jumps.
- [ ] Phone: capture a task, then pull to refresh, send the app to the
      background and back, and tick it. It lands once.
- [ ] Phone, reduce motion on: rows move to their slots without a
      slide, a tick regroups at once, and a capture appears at rest.

## Outcome

Built on 2026-11-10 on `feat/0060-reorder-ui-thread`, PR #103.

`src/components/motion/reorder.tsx` holds `createReorderSurface<P>()`
with `Root`, `Item`, `Grip` and `useDragging`. `Root` owns the session,
the bridge guard and the ghost in the `dragGhost` layer. `Item` takes
`payload`, `id`, `group`, `index`, `count` and `disabled`, registers
its animated ref and measures its group once at pickup. Slots come
from `slotForY` and `slotTops`. `onReorder({payload, group, from, to})`
runs once per drop and only when `from !== to`. A row's shift and
corners count only while its `index` equals the index it had at
pickup, so the commit that reorders the data carries zero shift.
Shared values reset after the commit, and at pickup and cancel. The
ghost renders `renderGhost` through `Overlay`.

`features/lists/lib/list-reorder.ts` holds
`createReorderSurface<TaskItem>()`. `lists-screen.tsx` wraps the pager
in `ListReorder.Root` and sends the drop through
`use-reorder-section`. `task-card-row.tsx` renders `Landing` and
`ListReorder.Item`; `TaskRow` takes `grip`. `Item` owns the card
corners and the divider, and `card-group-row.tsx` is a plain `View`
again for the page preview.

Deleted: `use-row-reorder.ts`, `reorder-row.tsx`, `reorder-ghost.tsx`,
`use-press-guard.ts` and its test, the web reorder handlers in
`lists-screen.tsx`, `layoutOrder`, both `freshMs` copies, `useRise`
and `lib/motion/legacy.ts` itself. Ticket 0062 had taken the file's
last sheet user, so nothing imported it. No caller of `usePressGuard`
remained. The 0058 allowlist is empty, so the list and its lint block
are gone.

Pager coexistence: `ListPager` reads `ListReorder.useDragging()`, a
context consumer inside `Root`. The pager re-renders at pickup and
drop only, never the screen and never per crossing. A resting row
leaves the pager on, so a sideways drag still pages. Gesture
arbitration alone did not hold on the web: the pager took the first
sideways move from the grip. The grip also claims on a 1 ms long
press, because a web pan with `minDistance: 0` waits for the first
move.

The tick holds are a map keyed by row uri in `use-tick-hold.ts`. No
timer remains. `TaskRow` runs `useProgress(done, { ms: tickWash,
onSettled })`. `onSettled(1)` ends that row's hold, and unmount
settles it too. A hold stores its neighbours and falls back to its
index, so a row that leaves first cannot push a held row past its
remaining neighbour.

`use-capture-task.ts` calls `markLanded(id)` before the optimistic row
mounts. `Landing id={task.uri}` takes the mark once. The remount under
the file uri finds nothing.

Tests on the web. The Playwright spec `e2e/specs/reorder.spec.ts`
runs in both projects, with the mouse and with CDP touch where a
gesture is involved. Its scenarios are the ticket's: the touch action
table, V6 connection through a group that empties, V8 one-slot and
instant drops plus a drop in place, the hold and pager cells, V9 two
ticks, the tick timing, V10 a tick after a drop, L3 leaving a held
row, V7 the capture remount chain, and the reduced-motion end states.
Three cells skip in the other project because they assert the motion
project's own behavior. The jsdom tests cover J2, the refetch uri
change and two and three tick holds. The two-hold placement and the
grip's first sideways move failed in the browser before their fixes.
`tsc`, eslint and vitest are green. The full suite on the rebased
branch was 288 passed and 24 skipped.

The capture scenario waits for the capture write to settle before it
ticks. A row that re-renders under a gesture handler press can drop it
on the web, and the capture's cache settle is such a render (ADR 0046).

Two tests outside the ticket changed for flakes the full run exposed.
The menu backdrop now uses `NoPanPressable`, the ADR 0046 press for a
target with no pan above it, so a press is not lost when the backdrop
re-renders. The capture sheet's clock tests step a paused page clock through the
open and the send close, so a loaded runner cannot skip every frame
between the states.

Not proven on a device. No Android emulator run with
`android-frames.mjs` happened, and no phone pass at 60 Hz or 120 Hz
happened. The emulator and phone acceptance boxes stay unchecked. The
2026-11-10 amendment to ADR 0032 records the drop and the web
evidence, and names both device checks as still open.
