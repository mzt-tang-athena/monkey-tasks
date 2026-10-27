---
id: 0061
title: Drag to schedule and the split grabber run on the UI thread
created: 2026-10-26
priority: high
assignee:
pr:
depends: [0058]
---

## Spec

Epic 0047, phase 4. ADR 0036 decides this. This ticket moves the
planner's drag to schedule (rows, pills and hour tasks onto hour rows,
week columns and month cells) and the day split grabber onto
`useLongPressDrag` and `drop-zones` from 0058. The work lands in the
phase 3 homes from 0056: `hooks/use-drag-session.ts`, `lib/day-rows.ts`
and the `day/` components in `src/features/planner`.

### What breaks today

Line numbers point at today's files.

| Bug | Today | What the user sees |
|---|---|---|
| V11 | `features/planner/components/drag.tsx:96-98`. `onBegin` fires at touch down and calls `beginHold`, which sets React state (`hooks/usePlannerGestures.ts:91-100`, `components/DaySpread.tsx:205-214`). | A scroll that starts on a row flashes the hold tint, and the screen renders twice. |
| L2 | `drag.tsx:119` rebuilds the pan when `task` or `api` changes identity. `DaySpread.tsx:311` makes `dayApi` depend on `rootPos` and `date`. | A store update or a layout change mid drag drops the gesture. |
| J2 | Each move sets the ghost on the JS thread (`usePlannerGestures.ts:159-160`, `DaySpread.tsx:282-283`). Each zone change sets React state (`usePlannerGestures.ts:163-167`, `DaySpread.tsx:286-291`). Each grabber move calls `setTimelineHeight` (`DaySpread.tsx:341`), which renders the whole day body. | The ghost lags the finger, and the resize stutters. |
| J3 | `drag.tsx:121` and `drag.tsx:152-155` each build a shake for the same source on native. | One shake value animates and the other plays unseen. |

The browser runs a second drag path: `hooks/useTouchDragGate.ts`, the
pointer handlers in `usePlannerGestures.ts:246-310` and
`DaySpread.tsx:425-504,521-537,650-663`, and the `onPointerDown` props
in `Timeline.tsx`, `TaskPills.tsx`, `TaskListSection.tsx` and
`WeekView.tsx`. This ticket deletes that path. It also deletes the
click guard after a drop (`usePlannerGestures.ts:138-143,193-220`,
`DaySpread.tsx:302-307,404-423,493-497`), which 0056 moves into
`use-drag-session`. Press targets on drag sources use gesture handler's
`Pressable` (0058), so a drag cancels the press. The source menu moves
to the `Menu` primitive in 0054, and 0058 swaps its motion.

### The drag

- A row, a pill and an hour task each use `useLongPressDrag`, with
  `holdMs` 300 for a row and 120 for a pill.
- The hold tint reads the hook's `hold` shared value through an
  animated style. React learns of the drag only at pickup.
- The readiness shake runs once per source, on one shared value, from
  `onActivate`. It passes `ReduceMotion.System`.
- At pickup, `useDragSession` stores the dragged task once (the ghost
  needs its name) and calls `measureAll()` on the zones. It also
  measures the day pane's visible band as the clip, as
  `DaySpread.tsx:268-275` does today.
- Hour rows, week columns and month cells register with `drop-zones`.
  The drag's `onMove` worklet runs `hitZone` and writes the hovered id
  to a shared value. Each zone tints through `useZoneStyle(id)`, so a
  zone change renders nothing.
- Hour rows, week columns and month cells are uniform grids. A grid
  can register one rect with its row and column sizes. `hitZone` then
  finds the cell with `Math.floor` in the worklet, with no measure per
  cell. @howljs/calendar-kit finds its slot this way
  ([useDragEventGesture.tsx](https://github.com/howljs/react-native-calendar-kit/blob/main/packages/react-native-calendar-kit/src/hooks/useDragEventGesture.tsx),
  lines 83 and 134).
- Each scroll container that holds zones writes its scroll offset to a
  shared value. `hitZone` adds the change in offset since pickup, so a
  pane that scrolls during a drag needs no new measure.
  react-native-drax does this (`hitTestWorklet` and
  `computeAbsolutePositionWorklet` in
  [src/math.ts](https://github.com/nuclearpasta/react-native-drax/blob/main/src/math.ts)).
- Keep `register` stable, and keep the hovered id out of React.
  react-native-reanimated-dnd keeps it in context. Each hover change
  then registers every zone again, and fast drops are lost
  ([#93](https://github.com/entropyconquers/react-native-reanimated-dnd/issues/93)).
- The drop hands the hovered id to `scheduleOnRN`. An hour zone writes
  that hour and keeps the task's minute. A day zone writes that date
  and keeps the task's time. A drop outside every zone writes nothing.
- One ghost sits at the planner root. Its animated style reads the
  hook's `x` and `y`.
- A hooks gesture keeps one handler for the life of its component and
  pushes config changes to it
  (`app/node_modules/react-native-gesture-handler/src/v3/hooks/useGesture.ts`,
  lines 32 and 86 to 108). A new `task` object mid drag therefore
  keeps the drag alive. Keep the drop callback stable anyway.

### The grabber

- The grabber uses `useLongPressDrag({ holdMs: 0 })`.
- The timeline pane's height is a shared value, clamped in the worklet
  between the minimum pane and the room above the bottom bar. An
  animated style sets the pane's `height` on the UI thread.
- The release writes the height to React state once, so the day
  preview (0059) draws the same split.

### Tests first

Each bug gets a failing test before its fix. The Playwright suite in
`app/e2e` (0049) runs each scenario with the mouse and with CDP touch.
Hour rows use the 0049 test id `timeline-hour:<hour>`, and rows use
`task-row:<name>`.

| Scenario | Proves |
|---|---|
| A touch drag of 200 px in 100 ms that starts on a day row. Sampled each frame, the row never shows the hold tint. | V11 |
| Hold a row for 300 ms and drag it onto `timeline-hour:14`. The hour row tints while hovered, the ghost stays within 4 px of the pointer, and the task's due time becomes 14 with its minute kept. | drag |
| Drop a row onto an hour, then tap a row's circle 100 ms later. The tap ticks it. Drop a row back on its source: nothing toggles and no editor opens. | click guard |
| Drag a pill onto Thursday in the week view, and a row onto a month cell. The date changes and the time stays. The month cell does not open its day. | zones |
| Release over no zone. Nothing changes and the ghost goes away. | drop |
| Start a drag, write another task through the store, then drop. The drop lands. | L2 |
| Drag the grabber 120 px down, then past its limit. The pane follows and stops at the limit. | grabber |
| A touch that moves before its hold scrolls the pane and lifts nothing. A touch that holds, then moves, drags and the pane stays still. | touch |
| With reduce motion emulated, the source does not shake, and the drag and the grabber still follow the pointer. | reduce motion |

A jsdom component test counts renders for J2. A drag across five hour
rows renders the day body once at pickup and once at the drop. A
120 px grabber move renders it once, at the release.

Today only the phone shows V11 and J3, because the browser takes the
pointer path. After this ticket, both platforms run one path, so the
browser test above covers V11.

## Acceptance

- [ ] Each scenario above has a failing test before its fix, and all
      pass after, with the mouse and with touch.
- [ ] `useTouchDragGate`, the planner's pointer handlers, the
      `onPointerDown` props and the click guard after a drop are gone.
      Lint passes with this ticket's files out of the allowlist.
- [ ] Phone, reduce motion off: a scroll that starts on a row shows no
      tint, a held row shakes once and follows the finger without lag,
      and a drop on an hour, a week day and a month cell writes the
      right date and time.
- [ ] Phone: a store update during a drag does not drop it, and the
      grabber resizes the split smoothly with a long day list.
- [ ] Phone, reduce motion on: no shake, and the drag and the grabber
      still follow the finger.

## Outcome
(filled in before moving to done/)
