---
id: 0060
title: Reorder, tick hold and capture entrance run on the UI thread
created: 2026-10-26
priority: high
assignee:
pr:
depends: [0058]
---

## Spec

Epic 0047, phase 4. ADR 0036 and its amendments to ADR 0032 and ADR
0034 decide this. This ticket moves the row reorder onto
`useLongPressDrag`, ends the tick hold from its animation, and replaces
the 90 second freshness window with a landed mark. The work lands in
the phase 3 homes from 0055: `hooks/use-row-reorder.ts`,
`hooks/use-tick-hold.ts`, `lib/tick-hold.ts` and
`components/task-card-row.tsx` in `src/features/lists`, and `TaskRow`
and `PreviewRow` in `src/components`.

### What breaks today

Line numbers point at today's files.

| Bug | Today | What the user sees |
|---|---|---|
| V6 | `app/(tabs)/index.tsx:200-210`. Sections carry no `key`, so a cell key reads `<sectionIndex>:<id>` (`@react-native/virtualized-lists/Lists/VirtualizedSectionList.js:281`). Ticket 0055 adds stable keys in `hooks/use-list-sections.ts` and a remount test. This ticket keeps that test green through the port. | A group that empties remounts every row below it. |
| V7 | `lib/motion.ts:54-66` and `components/TaskRow.tsx:50-93` test freshness on every mount. Remounts come from the move to Completed, from V6, from the id change on refetch (`store/tasks.tsx:804-810` gives `pending://N`, `features/tasks/query.ts:61` gives the file uri, refetch on focus in `store/query-client.ts:20-41`), from the reorder ghost (`index.tsx:976`) and from planner pills on a day change (`features/planner/components/drag.tsx:155`). | A task captured in the last 90 seconds fades and washes in again. |
| V8 | `index.tsx:401-496`. Native callbacks read `cb.current`, which a passive effect refreshes (`features/lists/ReorderRow.tsx:156-159`), and `moveReorder` and `endReorder` close over `reorder` state. A drop with a stale no-op `to` skips `setSettling` (`483-485`), so the reset (`568-577`) never runs. | A fast flick lands a slot off, or the rows stay overlapped. |
| V9 | `index.tsx:516-545`. A second tick replaces the first hold, and its index counts the first row. | The row below jumps above the second ticked row. |
| V10 | `index.tsx:476-479`. After a native drop, a 350 ms guard swallows the next tap. Gesture handler already cancels the press. The planner gets this right (`features/planner/hooks/usePlannerGestures.ts:138-143`). | A tick right after a drop does nothing. |
| J2 | `index.tsx:416,461,657-670,687-698`. Each move calls `setValue` on the JS thread, and each crossing calls `setReorder`. Ticket 0055 fixes the memo half: stable callbacks and a memoized `task-card-row`. The per-move and per-crossing work stays for this ticket. | The ghost lags, and rows render on each crossing. |
| J3 | `lib/motion.ts:18-45`. Each `TaskRow` (twice), `Pickup` and `NativeDragHandle` subscribes to `AccessibilityInfo` and calls the async `isReduceMotionEnabled()`. Native starts at `false`. | Slower mounts, and the first frames animate with reduce motion on. |
| L1 | `index.tsx:453-459`. The row slides ignore reduce motion. | Rows slide with reduce motion on. |
| L3 | `index.tsx:307` keeps `holdTimer` after unmount. `index.tsx:623-627` never deletes a row ref. `index.tsx:343-358` sums heights from the first measured rect. | A long section can pick the wrong slot. |

### Step 1: settle the drop on a phone

The drop still hands work from the UI thread to a React commit: the
data reorders, and the row offsets must reach zero in the same frame.
Build the options behind a flag and run them on the phone at 60 Hz
and at 120 Hz:

- **A.** Offsets live in shared values. The drop commits the new order
  and zeroes the offsets in a `useLayoutEffect` keyed on that order.
- **B.** The list renders as one `Animated.FlatList`, with headers as
  items and `itemLayoutAnimation={LinearTransition}`. Each crossing
  reorders a preview copy of the data, and the layout transition moves
  the rows. The dragged row's cell stays empty under the ghost.
- **C.** Each moved row gets a new React key at the drop, for example
  `${id}#${dropCount}`. The moved rows mount again at their new places
  with zero offset, so no reset races the commit.
  react-native-reorderable-list does this (`createCellKey` and
  `markCells` in
  [ReorderableListCore.tsx](https://github.com/omahili/react-native-reorderable-list/blob/291621a050e5fb176984a2270460d5caaf099085/src/components/ReorderableListCore.tsx)).
  The landed mark from 0058 stops the entrance on a remount.

Keep the option that shows no blink in a screen recording at both
rates. Add a dated note with the result to ADR 0032 and delete the
other options.

### Step 2: the reorder

- A row uses `useLongPressDrag({ holdMs: 300 })`, and the grip uses
  `holdMs: 0`. Each row's press targets use gesture handler's
  `Pressable`, so an active drag cancels them on every platform. The
  350 ms guard and the drop arm of `use-press-guard` go away. If the
  hook has no caller left after 0059 and 0061, delete it.
- At pickup, measure the section's mounted rows once. Slot math uses
  each row's own measured top and height. A row the list has not
  mounted cannot become a target. A ref callback that gets `null`
  deletes its entry.
- The slot, the row offsets, the corner radii and the divider all run
  in shared values and animated styles. ADR 0032's rule stays: the
  radii follow the slot a row heads to. A crossing writes no React
  state.
- The drop passes `from` and `to` from the UI thread to
  `scheduleOnRN`, so no callback reads stale state. Every drop resets
  the offsets, a drop in place included.
- The drop compares the `from` and `to` indexes to decide if the row
  moved. It never compares positions. A release exactly on the new
  slot must still reorder and reset. react-native-reorderable-list
  has this bug open
  ([#75](https://github.com/omahili/react-native-reorderable-list/issues/75)).
- The ghost renders a `PreviewRow`, not a `TaskRow`.
- Every slide passes `ReduceMotion.System`.

### Step 3: the tick hold

- Each tick holds its own row, and several holds can run at once. A
  held row keeps its place among the rows that stood around it at
  tick time. Extend the pure placement in `lib/tick-hold.ts` (0055)
  and its tests to cover two and three holds. A second tick never
  moves another row.
- The tick plays on shared values in `TaskRow`: the circle fills, the
  check scales in, and the wash crosses the row in 320 ms. The wash's
  completion callback releases the hold through `scheduleOnRN`.
  Unmount also releases it. No timer remains.
- An untick during the hold drops that hold at once.

### Step 4: the capture entrance

- The capture mutation (0052) calls `markLanded(id)` from
  `src/lib/motion/entrances.ts` when it inserts the row. `TaskRow` and
  a planner pill call `takeLanded(task.id)` once, in a state
  initializer. Only a row that finds the mark runs the `landing`
  entering animation and the wash. A remount never finds it again.
- Delete `useRise`, both copies of `freshMs`, and `useReduceMotion`
  from `lib/motion.ts`. No component calls `AccessibilityInfo` for
  motion. Animations pass `ReduceMotion.System`, and a component that
  must branch reads Reanimated's `useReducedMotion`.
- Remove this ticket's files from the 0058 lint allowlist.

### Tests first

Each bug gets a failing test before its fix. The Playwright suite in
`app/e2e` (0049) runs each scenario with the mouse and with CDP touch.
Rows and grips use the 0049 test ids `task-row:<name>` and
`reorder-grip:<name>`. Pin time with `page.clock.install`, never
`setFixedTime`, because a frozen clock never ends an entrance (0049).

| Scenario | Proves |
|---|---|
| Tick the last task of a group. The DOM nodes of the rows below stay connected. | V6 |
| Capture a task, then within 90 seconds tick it, drag it in My order, and switch tabs and back. Each mounted copy shows opacity 1 on its first frame. | V7 |
| In My order, drag a row one slot and release at once after the crossing. It lands in the slot the gap showed, and every other row rests at offset 0. Drag away and back, then drop in place: all offsets read 0. | V8 |
| In My order, drag a row onto the next slot and release with no further move once its offset equals that slot. It reorders, and every offset reads 0. | the index rule |
| Tick two adjacent rows 100 ms apart, top first. Sampled each frame for 400 ms, the third row never rises above the second. | V9 |
| Drop a row, then tick another row 100 ms later. The tick lands. Drop a row on its own place: nothing toggles and no editor opens. | V10 |
| Tick a row. At 200 ms it sits in its group, and at 600 ms it sits in Completed. | hold |
| Navigate away 100 ms after a press on a row, then come back. The console shows no error and no row hangs lifted. | L3 |
| With reduce motion emulated, a drag moves rows straight to their slots, a tick regroups at once, and a capture lands at rest. | L1, J3 |

A jsdom component test covers J2. A drag that crosses three slots
renders the lists screen no times between pickup and drop, and no
`TaskRow` renders. This replaces the looser crossing test from 0055. A second component test covers the refetch id
change with the 0051 vault adapter fake: the row that remounts under
its file uri runs no entrance.

Only the phone shows V8's stale window, J3's async start, and today's
form of V10, because the browser path reads pointer events in render.

## Acceptance

- [ ] Each scenario above has a failing test before its fix, and all
      pass after, with the mouse and with touch.
- [ ] ADR 0032 carries a dated note naming the drop option that won
      and the phone and refresh rates it ran on.
- [ ] The reorder, the tick hold and the entrance use only
      `src/lib/motion` and Reanimated. Lint passes with this ticket's
      files out of the allowlist.
- [ ] `useRise`, `freshMs` and the 350 ms guard are gone from the
      lists screen.
- [ ] Phone, reduce motion off: a long press lift, a grip drag, a
      fast flick, a drop in place and a scroll that starts on a row
      all behave. No row blinks at the drop, and no tap after a drop
      goes missing.
- [ ] Phone: tick three rows in quick order; each fills, washes and
      then moves to Completed, and no other row jumps.
- [ ] Phone: capture a task, then pull to refresh, send the app to the
      background and back, and tick it. It lands once.
- [ ] Phone, reduce motion on: rows move to their slots without a
      slide, a tick regroups at once, and a capture appears at rest.

## Outcome
(filled in before moving to done/)
