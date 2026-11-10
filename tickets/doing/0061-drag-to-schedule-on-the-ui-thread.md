---
id: 0061
title: Drag to schedule and the split grabber run on the UI thread
created: 2026-10-26
priority: high
assignee: omp
pr:
depends: [0058]
---

## Spec

Epic 0047, phase 4. ADR 0036 and ADR 0046 decide this. This ticket
moves the planner's drag to schedule onto `createDragSurface` from
0058. Rows, pills and hour tasks drop onto hour rows, week columns and
month cells. It also builds `Split` on 0058's engine and moves the day
split grabber onto it. Paths are on `epic/0047-rebuild` at commit
`745976f`, under `app/src`.

### Design, 2026-11-08

This spec follows the 2026-11-08 design package for phase 4. ADR 0046
records it. What matters here:

- The planner writes no gesture code. It makes one
  `PlanDrag = createDragSurface<TaskItem, PlanTarget>()`, renders its
  `Root`, `Source`, `Zone` and `Grid`, and gets one
  `onDrop(task, target)` per drop.
- Targets are data. `PlanTarget` replaces the `hour:` and `day:`
  strings, and a pure `patchForDrop` turns a drop into a write.
- The owner chose the row hold (300 ms) for hour tasks. Rows and hour
  tasks use `hold: "row"`, and pills use `hold: "pill"` (120 ms).
- The owner chose one shared hold tint and shake look. The surface owns
  the tint, the shake, the hover tint and the lifted look.
- Scrollers freeze while a drag is active, so rects measured at pickup
  stay true. The old plan's scroll offset bookkeeping and explicit clip
  go away. On the web the freeze is a `touchmove` listener, because the
  prototype showed that `overflow: hidden` cancels the drag, 20 runs in
  20.
- The grabber is `<Split>`, laid out by fraction, so the first frame is
  right before any layout reports.

### What breaks today

| Bug | Today | What the user sees |
|---|---|---|
| V11 | `features/planner/components/drag.tsx:96-98`. `onBegin` fires at touch down and starts a hold that sets React state (`features/planner/hooks/use-drag-session.ts:214-223,232-244,332-345`, `planner-screen.tsx:124-149`). | A scroll that starts on a row flashes the hold tint, and the screen renders twice. |
| L2 | `drag.tsx:119` rebuilds the pan when `task` changes identity. 0056 made `api` stable. | A store update or a layout change mid drag drops the gesture. |
| J2 | Each move sets the ghost on the JS thread, and each zone change sets state (`use-drag-session.ts:129-135,139-158,320-324,374-379`). Each grabber move calls `setChosen` (`hooks/use-split-pane.ts:77-84,108-110`, `day/day-spread.tsx:96,104-106`), which renders the day body and the day preview. | The ghost lags the finger, and the resize stutters. |
| J3 | `drag.tsx:121` and `drag.tsx:152` each build a shake for the same source on native. | One shake value animates and the other plays unseen. |
| V12 | `use-drag-session.ts:399` and `drag.tsx:110-117`. A pointer cancel or a native cancel counts as a drop. | A cancelled touch drops the task where the finger was. |

The browser runs a second drag path today:
`hooks/use-touch-drag-gate.ts`, `pointerHandlers` from
`use-drag-session.ts` spread on the planner root, and `onPointerDown`
props in `timeline.tsx`, `task-pills.tsx`, `task-list-section.tsx`,
`week-view.tsx`, `day/overdue-group.tsx`, `day/split-handle.tsx` and
`day/day-spread.tsx`. A 350 ms click guard (`clickGuardMs` and
`consumeClick` in `use-drag-session.ts`, used by
`use-planner-gestures.ts:63-89`) swallows the click after a drop. A
mouse promotes after 8 px with no hold. This ticket deletes that path.

### The first frame of the split

Found on 2026-11-07, while a CI run failed on PR #86. `useSplitPane`
(`hooks/use-split-pane.ts:47-53`) gives the timeline its usual 320 px
until the root, body and pane layouts report. On a 360 by 640 screen
the settled height is 200 px. So every load paints at least one frame
with the list pane 120 px too low, and the source toggle sits 6 px over
the bottom bar. Then the pane jumps up.

Repro: record the toggle's bottom edge on each animation frame from an
init script, with the CPU throttled 6 times through CDP. Every load
records 591, then 471, against a bar top of 585.

### What the surfaces make impossible, and what stays here

By construction, once the planner renders `PlanDrag` and `Split`:

- V11. The hold cue is the source's own shared value, and it starts
  80 ms after the touch. A scroll fails the pan at its slop first.
  React learns of the drag only at pickup.
- L2. One gesture handler per source for its life. Worklets pass ids,
  and the root reads the newest task and the newest `onDrop`.
- J2. The ghost, the hover and the split height are shared values. A
  zone change and a grabber move render nothing.
- J3. The source shakes once, on activate, with
  `ReduceMotion.System`.
- V12, for drags. Only an uncancelled end drops. A cancel returns.
- The click guard. Press targets inside sources are gesture handler's
  `Pressable`, so a drag's activation cancels them.
- The split's first frame. `Split` lays out by fraction with `flex`,
  and its two panes always fill its box.

This ticket still owns:

- `PlanTarget` and the pure `patchForDrop`, with Vitest.
- The zone and grid targets on each screen.
- The day preview's still split, through `SplitStill`.
- V7, the planner half. A pill wraps in `Landing`, not `useRise`.
- The source toggle's long press token.

### Step 1: build `Split`

Build `src/components/motion/split.tsx` with the 0058 signature.

- The grabber holds with `hold: "grip"` (0 ms, `touchAction: 'none'`).
- The top pane's height is a shared value while the finger moves,
  clamped in the worklet to `minTop` and `minBottom` against the
  container height measured at pickup.
- The release calls `onResize(fraction)` once.
- At rest, both panes lay out with `flex` from `fraction`, so no frame
  before layout uses a px default.
- `SplitStill` draws the same layout with no grabber.

### Step 2: the drag

```ts
// features/planner/lib/plan-drag.ts
export type PlanTarget = { kind: "hour"; hour: number } | { kind: "day"; iso: string };
export const PlanDrag = createDragSurface<TaskItem, PlanTarget>();
export function patchForDrop(task: TaskItem, target: PlanTarget, routeDay: Date): DragPatch;
```

`DragPatch` is `Partial<TaskFrontmatter>`. Today it lives in
`hooks/use-drag-session.ts` (line 27), which this ticket deletes, so
move it to `plan-drag.ts`.

- `patchForDrop` is pure, with a Vitest file. An hour target writes that
  hour on the route day and keeps the task's minute. A day target
  writes that date and keeps the task's time. It replaces `resolve` in
  `hooks/use-planner-gestures.ts` (line 41), and `dayOfZone` and
  `hourOfZone` in `lib/dropzone.ts`.
- `planner-screen.tsx` renders one `PlanDrag.Root` around the body for
  day, week and month, with
  `onDrop={(task, target) => write(task, patchForDrop(task, target, routeDay))}`
  and `renderGhost={(task) => <GhostPill task={task} />}`. A drop
  outside every zone calls nothing.
- `GhostPill` is today's `components/drag-ghost.tsx` look, with no
  animation of its own.
- A day row, an overdue row and an hour task render
  `<PlanDrag.Source payload={task} hold="row">`. A pill renders
  `hold="pill"`. Each press target inside a source is gesture handler's
  `Pressable`.
- Hour rows in `timeline.tsx` render
  `<PlanDrag.Zone target={{ kind: "hour", hour }} testID={`timeline-hour:${hour}`}>`.
  Hour rows differ in height, so each keeps its own measured rect.
- Week columns are one `PlanDrag.Grid` with `columns={7}` and `rows={1}`
  inside a `MotionScrollView horizontal`. Month cells are one
  `PlanDrag.Grid` with `columns={7}` and `rows={6}`. A blank cell is
  `null`.
- A scroller that holds zones is a `MotionScrollView`, or a list with
  `renderScrollComponent={renderMotionScroll}`.
- A mouse drag now holds like a touch. Today a mouse promotes after
  8 px.
- Delete `drag.tsx`, `use-drag-session.ts` and its test,
  `use-touch-drag-gate.ts`, `lib/dropzone.ts` and its test, and every
  `onPointerDown` prop. `day/day-panes.test.tsx` imports
  `useDragSession`, `DropZoneMap` and `DragPatch`, so rewrite it onto
  `PlanDrag`. Delete `use-planner-gestures.ts` once nothing
  is left in it after 0059. A pill's `useRise` becomes `Landing`. Delete
  `useShake` from `lib/motion/legacy.ts`, and `useRise` too if 0060
  already removed its last other caller.

### Step 3: the grabber

- `day/day-page.tsx` renders `<Split testID="day-split" fraction onResize
  minTop={motion.split.minPane} minBottom={motion.split.minPane}
  top={<TimelinePane />} bottom={<DayListPane />} />`.
- `fraction` is React state in the day screen, written once per
  release. It is not stored on disk today, so no saved value changes
  meaning.
- Pick the default fraction so that on the 412 by 915 e2e viewport the
  timeline starts near today's settled height. On a 360 by 640 screen
  the list pane must start fully above the bar.
- `day/day-preview.tsx` draws `SplitStill` with the same `fraction`.
- Delete `use-split-pane.ts` and `day/split-handle.tsx`. In
  `day/day-spread.tsx`, delete what 0059 left on the day root for the
  web resize: the `split.move` and `split.end` pointer handlers and the
  `useTouchDragGate` call.

### Step 4: tokens

`source-toggle.tsx` reads `motion.ms.longPress` (450) for its long
press, in place of `drag.holdMs`. Move the remaining `drag` users onto
`motion`, and delete `drag` from `src/theme/tokens.ts` once 0060 has
also moved off it. Remove this ticket's files from the 0058 lint
allowlist. That includes `day/day-spread.tsx`, which 0059 left there.

### Tests first

Each bug gets a failing test before its fix. The Playwright suite in
`app/e2e` runs each scenario with the mouse and with CDP touch. Hour
rows use the test id `timeline-hour:<hour>`, and rows use
`task-row:<name>`. A hold uses `holdDrag` from `app/e2e/gestures.ts`,
which pauses the clock and calls `page.clock.runFor` past the hold
(0058). Gesture handler's web long press is a `setTimeout`, so a paused
clock stalls it until `runFor` steps past it. Reduce motion scenarios
run in the `reduced-motion` project.

| Scenario | Proves |
|---|---|
| `expectTouchAction` reads `pan-y` on a day row, a pill and an hour task, and `none` on the grabber. | the hold table |
| A touch drag of 200 px in 100 ms that starts on a day row. Sampled each frame, the row never shows the hold tint. | V11 |
| Hold a row and drag it onto `timeline-hour:14`. The hour row tints while hovered, the ghost stays within 4 px of the pointer, and the task's due time becomes 14 with its minute kept. | drag |
| Hold an hour task for 300 ms and drag it onto another hour. It moves. Released at 150 ms, it lifts nothing. | the row hold for hour tasks |
| Drop a row onto an hour, then tap a row's circle 100 ms later. The tap ticks it. Drop a row back on its source. Nothing toggles and no editor opens. | the click guard is gone |
| Drag a pill onto Thursday in the week view, and a row onto a month cell. The date changes and the time stays. The month cell does not open its day. | zones |
| Release over no zone. Nothing changes and the ghost goes away. | drop |
| A touch drag that ends in `touchCancel`. Nothing changes. | V12 |
| Start a drag, write another task through the store, then drop. The drop lands. | L2 |
| Drag the grabber 120 px down, then past its limit. The pane follows and stops at the limit. | grabber |
| A touch that moves before its hold scrolls the pane and lifts nothing. A touch that holds, then moves, drags, and the pane stays still. | the scroll freeze |
| In the `reduced-motion` project, the source does not shake, and the drag and the grabber still follow the pointer. | reduce motion |

A jsdom component test counts renders for J2. A drag across five hour
rows renders the day body once at pickup and once at the drop. A
120 px grabber move renders it once, at the release.

The split's first frame gets its own test. Record the frames from the
first paint on a 360 by 640 screen with the CPU throttled 6 times, and
find no frame with the source toggle over the bar.

After this ticket both platforms run one path, so the browser tests
cover V11 and J3 too.

## Acceptance

- [ ] On a 360 by 640 screen, no frame from the first paint draws the
      day list pane over the bottom bar.
- [ ] Each scenario above has a failing test before its fix, and all
      pass after, with the mouse and with touch.
- [ ] `src/components/motion/split.tsx` exists with the 0058 signature,
      and the day screen resizes only through `Split`.
- [ ] `PlanTarget` and `patchForDrop` live in
      `features/planner/lib/plan-drag.ts`, with Vitest. No `hour:` or
      `day:` string ids remain.
- [ ] `use-touch-drag-gate.ts`, `use-drag-session.ts`, `drag.tsx`,
      `lib/dropzone.ts`, `use-split-pane.ts`, `split-handle.tsx`, the
      split's pointer handlers in `day-spread.tsx`, the `onPointerDown`
      props and the click guard are gone. Lint passes
      with this ticket's files out of the allowlist.
- [ ] Emulator, with the `verify-monkey-tasks` Android path: a scroll
      that starts on a row shows no tint, a held row shakes once and
      follows the finger, and a drop on an hour, a week day and a month
      cell writes the right date and time.
- [ ] Emulator: a store update during a drag does not drop it, and the
      grabber resizes the split with a long day list.
- [ ] Phone, reduce motion off: the ghost follows the finger without
      lag, and the grabber resizes smoothly.
- [ ] Phone, reduce motion on: no shake, and the drag and the grabber
      still follow the finger.

## Outcome
(filled in before moving to done/)
