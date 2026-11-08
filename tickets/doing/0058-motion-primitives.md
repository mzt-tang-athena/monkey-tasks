---
id: 0058
title: Motion surfaces on Reanimated and gesture handler hooks
created: 2026-10-26
priority: high
assignee: claude-code
pr:
depends: [0055, 0056, 0057]
---

## Spec

Epic 0047, phase 4. ADR 0036 decides that motion runs on the UI thread.
ADR 0046 decides its shape: five surfaces in `src/components/motion`,
pure math and clocks in `src/lib/motion`, and no worklet in feature
code. This ticket adds the libraries, builds the engine, the drag
surface, `Pager` and `Landing`, adds the lint rules, and swaps the
`Menu` entrance. It ports no screen. Tickets 0059 to 0062 port the
screens onto the surfaces.

Read first: ADR 0036, ADR 0046, then ADR 0033 (pager) and ADR 0032
(reorder). Paths are on `epic/0047-rebuild` at commit `745976f`, under
`app/`.

### Design, 2026-11-08

This spec comes from the design package of the 2026-11-08 architect
run: two candidates (hooks and surfaces), a synthesis, two owner
decisions and a web prototype. The package was a scratch folder and is
gone. ADR 0046 keeps the decision and the prototype facts. This ticket
keeps what a builder needs:

- Surfaces won over hooks. A feature passes data and plain functions,
  so it cannot write the worklet that crashes on the phone (ADR 0019).
- The owner chose one hold tint and one shake look for Lists and
  Planner. The surfaces own them, with no style props.
- The owner chose the row hold (300 ms) for the Planner's hour tasks.
- The prototype settled four questions on the web build. Gesture
  handler's `Pressable` cancels under a parent pan. A paused Playwright
  clock drives Reanimated and stalls the long press. `overflow: hidden`
  cancels a drag, and a `touchmove` listener does not. `measure()` in
  `onActivate` works, in page coordinates.
- Gesture handler 3.3.0 drops the detector's `touchAction` prop on the
  web. Pass `touchAction` in the gesture config. ADR 0046 gives the
  source lines.

### What the surfaces make impossible

0058 fixes no screen bug itself. Once a screen uses a surface as shown,
these bugs cannot come back. Each port ticket proves its share with a
test.

| Bug | Where it dies | Port |
|---|---|---|
| V1 | `Pager` keeps a preview while its page is on screen. | 0059 |
| V2 | A touch during a settle commits the pending page and rebases. | 0059 |
| V3 | Cells sit at their page's place. A commit changes props only. | 0059 |
| V8 | `from` and `to` come from the UI thread. Shifts carry an index stamp. | 0060 |
| V10, B1 | Every press target is gesture handler's `Pressable`, so a pan cancels it. Lint bans the other one. | 0059, 0060 |
| V11 | The hold cue is a shared value that starts after 80 ms. | 0061 |
| V12 | Gesture handler captures the pointer. Only an uncancelled end commits. | 0059, 0061 |
| J2 | The ghost, hover, slots, radii and split height are shared values. | 0060, 0061 |
| J3 | Lint bans `AccessibilityInfo` motion reads. A source shakes once. | 0060, 0061 |
| L2 | Worklets pass ids. The root reads the newest payload and callback. | 0061 |
| L3 | No hold timer. Only mounted rows are measured. A generation drops stale measures. | 0060 |
| B2 | The surface sets `touchAction` in the gesture config. | 0059 |
| Split first frame | `Split` lays out by fraction with `flex`. | 0061 |

These stay half or whole feature work: V4 (the previews draw from the
top), V5 (the day preview), V6 (done in 0055), V7 (the capture mutation
calls `markLanded`), V9 (the hold placement), J1 (the list preview's
row count), J4 (the `Sheet` on `useProgress`) and L1 (the tab strip's
`scrollTo`).

### 1. Move `src/lib/motion.ts` first

`src/lib/motion.ts` is a file, and this ticket needs a folder at that
path. Land this move as its own commit before anything else, with no
change in behavior:

- `git mv src/lib/motion.ts src/lib/motion/legacy.ts`.
- Point its five importers at `@/lib/motion/legacy`:
  `src/components/swipe-pager.tsx`, `src/components/task-row.tsx`,
  `src/components/ui/menu.tsx`, `src/components/ui/sheet.tsx` and
  `src/features/planner/components/drag.tsx`.
- `legacy.ts` sits on the lint allowlist (step 5). Each port deletes
  the exports it replaces: `useMenuEntrance` (this ticket),
  `useRise` (0060), `useShake` (0061), `useSheetMotion` (0062), and
  `useReduceMotion` and `easeOut` with their last caller. The port
  that empties the file deletes it.

### 2. Add the libraries

Run this in `app/`:

```sh
npx expo install react-native-reanimated react-native-worklets
npx expo install --check
```

The first command pins the SDK 58 versions, `react-native-reanimated`
4.7.1 and `react-native-worklets` 0.13.0. Both sit in `node_modules`
today only as transitive packages. The check must pass.

Add no Babel config. `babel-preset-expo` 58.0.18 adds
`react-native-worklets/plugin` whenever that package resolves
(`node_modules/babel-preset-expo/build/configs/expo.js`, lines 104 to
111). Do not add `react-native-reanimated/plugin` too. Wrap the Metro
config with `wrapWithReanimatedMetroConfig` from
`react-native-reanimated/metro-config`, so worklet errors carry
readable stacks.

The 0048 harness renders components through react-native-web in jsdom.
Load Reanimated's web build there. If it fails under jsdom, alias
`react-native-reanimated` to `react-native-reanimated/mock` for
component tests only, and assert end states. Reanimated 4.7.1 exports
`setUpTests`, `withReanimatedTimer` and `advanceAnimationByTime`.

### 3. Rebuild the APK

JS that imports Reanimated crashes on an APK without its native module.
Build a dev or release APK from the branch with the `android` workflow
(`gh workflow run android`). The Android path of the
`verify-monkey-tasks` skill (`.claude/skills/verify-monkey-tasks/`,
section "Android", ticket 0073) installs it on an emulator. Record the
run id in the Outcome. Every native check in 0059 to 0062 runs on this
build or a later one.

### 4. Build the two folders

#### `src/lib/motion/`: tokens, math and clocks

No file here imports `src/components`. Every function in a pure file
starts with `'worklet';` and imports nothing from React, react-native
or Reanimated. Under Vitest the directive is a plain string, so one
function runs on the UI thread and in a unit test. Each pure file has a
Vitest file beside it.

| File | Contents |
|---|---|
| `tokens.ts` | `motion.ms`: tap 120, return 180, settle 220, landing 220, tickWash 320, landWash 600, sheet 220, menu 140, longPress 450. `motion.easeOut` is `Easing.bezier(0.16, 1, 0.3, 1)`. `motion.swipe`: slop 12, commit 80, flick 500 px/s, rubber 0.28, rubberMax 48. `motion.hold`: row 300, pill 120, grip 0, cue 80, slop 8. `motion.split.minPane` 150. `HoldKind` is `"row" \| "pill" \| "grip"`. One table maps each kind to its ms and its `touchAction`: `pan-y` for row and pill, `none` for grip. |
| `progress.ts` | `timing(to, ms, done?)` and `spring(to, config, done?)`, worklets that always pass `ReduceMotion.System`. `done` is a plain JS function, called through `scheduleOnRN` only when the animation finishes. `useProgress(target, { ms, onSettled })` returns a branded `Progress`. `Progress` exposes a read-only `.value` that animated styles read, and no setter. No `useReducedMotion` re-export. |
| `entrances.ts` | `markLanded(id)`, `takeLanded(id)`, and `menuEntering(corner)`, an entering animation. |
| `pager-math.ts` | `follow(dx, bounds, page)` returns the finger travel, or the rubber band at a closed end. `releaseTarget({ dx, vx, width, bounds, page })` returns -1, 0 or 1. `visiblePages(pos, width)` returns the pages on screen. `canGo(bounds, page)` reads data, not a callback. |
| `drag-math.ts` | `slotForY(y, rows)`, `slotTops(order, rows, gap)` (today `layoutOrder` in `features/lists/lib/reorder.ts`, lines 48 to 61), `hitZone(x, y, zones, grids, clips)`, and `cardPosition(index, count)` (moved from `components/ui/card-group-row.tsx`, which re-exports it). A grid zone is one rect with `columns`, `rows` and `cells`, and `hitZone` finds its cell with `Math.floor`. A `null` cell is no target. |
| `drag-machine.ts` | `step(state, event)` returns `{ state, effect }`. Phases: `idle`, `pending`, `dragging`, `settling`. Events: `begin`, `activate`, `release` with `canceled`, `finalize`, `settled`. Effects: `none`, `pickup`, `drop`, `cancel`, `flush`. |

`src/theme/tokens.ts` keeps `drag` for today's callers, but it reads
each value from `motion`, so one number lives in one place.
`drag.holdMs` (450) is the source toggle's long press, not a drag hold.
It becomes `motion.ms.longPress`, so it no longer reads like
`hold.row`. The port that removes the last `drag` user deletes `drag`.

`useProgress` rules, which 0060 to 0062 rely on:

- `onSettled(at)` runs once per run, with 0 or 1, or once at unmount.
- A reversal before the end supersedes the run, and its `onSettled`
  never runs.
- With reduced motion, it holds its end value from the first frame, and
  `onSettled` runs with no clock time.

#### `src/components/motion/`: the surfaces

Features import only these files. They may import `@/lib/motion/tokens`,
`markLanded` from `@/lib/motion/entrances`, and `useProgress` and
`Progress` from `@/lib/motion/progress`. Nothing else in either folder.

```ts
// pager.tsx
export function Pager(props: {
	index: number; bounds?: { first?: number; last?: number };
	onPage: (next: number) => void; renderPreview: (page: number) => ReactNode;
	fill?: boolean; testID?: string; children: ReactNode;
}): ReactElement;

// drag-surface.tsx
export function createDragSurface<P, T>(): {
	Root(props: { onDrop: (payload: P, target: T) => void; renderGhost: (payload: P) => ReactNode; children: ReactNode }): ReactElement;
	Source(props: { payload: P; hold: HoldKind; disabled?: boolean; style?: StyleProp<ViewStyle>; testID?: string; children: ReactNode }): ReactElement;
	Zone(props: { target: T; style?: StyleProp<ViewStyle>; testID?: string; children?: ReactNode }): ReactElement;
	Grid(props: { columns: number; rows: number; cells: readonly (T | null)[]; style?: StyleProp<ViewStyle>; testID?: string; children?: ReactNode }): ReactElement;
	useDragging(): boolean;
};

// reorder.tsx (built in 0060 on the same engine)
export type ReorderMove<P> = { payload: P; group: string; from: number; to: number };
export function createReorderSurface<P>(): {
	Root(props: { onReorder: (move: ReorderMove<P>) => void; renderGhost: (payload: P) => ReactNode; children: ReactNode }): ReactElement;
	Item(props: { payload: P; id: string; group: string; index: number; count: number; disabled?: boolean; style?: StyleProp<ViewStyle>; testID?: string; children: ReactNode }): ReactElement;
	Grip(props: { testID?: string; accessibilityLabel?: string }): ReactElement;
};

// split.tsx (built in 0061 on the same engine)
export function Split(props: { fraction: number; onResize: (fraction: number) => void;
	minTop: number; minBottom: number; top: ReactNode; bottom: ReactNode; testID?: string }): ReactElement;
export function SplitStill(props: Omit<SplitProps, "onResize">): ReactElement;

// landing.tsx
export function Landing(props: { id: string; children: ReactNode }): ReactElement;

// scroll-view.tsx
export function MotionScrollView(props: ScrollViewProps): ReactElement;
export function renderMotionScroll(props: ScrollViewProps): ReactElement;
```

`internal/` holds `session.ts`, `source.tsx`, `contexts.ts`,
`bridge.ts` and the one helper that builds a gesture config with
`touchAction`. This ticket builds the engine, `createDragSurface`,
`Pager`, `Landing` and `MotionScrollView`. `createReorderSurface` lands
with 0060 and `Split` with 0061.

#### Data shape

Each surface mount owns one session. Each field has one writer.

| State | Lives in | Sole writer | Crosses to JS |
|---|---|---|---|
| Pager `pos`, in pages from the mount origin | shared value | the pager's gesture and settle worklets | never |
| Pager `landed`, the base of the next gesture | shared value | pager worklets | `onPage(next)` at a landing |
| `index`, `bounds` | React props | the screen | mirrored to shared values each render |
| Pager visible set | React state in `Pager` only | a reaction, at most once per change of the set | n/a |
| Drag `phase`, `owner` | shared values | the owning source, through `drag-machine.step` | pickup, drop |
| Finger `x`, `y`, grab point | shared values | the owning source's `onUpdate` | never |
| Hold cue, 0 to 1 | one shared value per source | that source | never |
| Zone registry: id to animated ref | one shared value per session | each `Zone` or `Grid` adds its key at mount and deletes it at unmount | never |
| Zone rects, in page coordinates | one shared value per session | the owning source's `onActivate`, through `measure()` | never |
| Hover target | shared value | the owning source's `onUpdate` | at drop, as an id |
| Payloads and targets | JS maps in the root, refreshed in a layout effect | each source or zone, its own id | read at pickup and drop |
| `active` (`{ payload } \| null`) | React state in the root | the root's pickup and drop handlers | ghost, `useDragging`, scroll freeze |
| Pickup guard `{ token, generation }` | JS ref in the root | the bridge | makes drop or cancel run once |
| `useProgress` value | shared value | `useProgress` | `onSettled(at)` |

Worklets carry numeric ids, never payloads. A new `task` object
mid-drag changes nothing (L2). The UI runtime runs one thing at a
time, so the first source to activate claims `owner`.

#### How `Pager` behaves

- One pan: `usePanGesture` with `activeOffsetX: [-12, 12]`,
  `failOffsetY: [-12, 12]` and `touchAction: 'pan-y'` in the config.
  The hooks throw on `minDistance` beside offsets.
- Cells sit at `left: (page - origin) * 100%`, a React prop. The track
  moves by `translateX = -pos * width`. At mount `pos` is 0, so the
  first frame is right before `onLayout` reports. A commit changes
  props only, and `pos` already equals the target (ADR 0036, rule 1).
- The live cell keys on `index`, so a landed page mounts at its top.
- The release reads `translationX` and `velocityX` through
  `releaseTarget`. The settle calls `onPage(next)` once per landing,
  through the internal bridge.
- A touch during a settle commits the pending page at once and makes
  it the next gesture's base. Two fast flicks move two pages.
- Only an `onDeactivate` with `canceled: false` can commit. A cancel
  returns.
- A new `index` one page away slides from where `pos` stands. A jump of
  more than one page cuts. Either way, the old page's preview stays
  drawn until `pos` lands, so a late write shows the old picture, never
  a blank.
- With reduced motion, the page does not follow the finger. A release
  past the threshold commits through the internal bridge. Its
  `scheduleOnRN` call is a microtask on the web, so the `reduced-motion`
  project sees the commit with no clock time.

#### How the drag surface behaves

- A source with `hold: "row"` or `"pill"` uses `usePanGesture` with
  `activateAfterLongPress` from the hold table. A `"grip"` source uses
  `minDistance: 0`. `touchAction` comes from the same table, in the
  gesture config.
- The hold cue starts 80 ms after `onBegin`. A scroll fails the pan at
  its slop before any tint shows (V11). React learns of the drag only
  at pickup.
- The source shakes once, on `onActivate`, with `ReduceMotion.System`.
  The hold tint, the shake, the hover tint and the lifted look are the
  surface's own, from tokens. No prop changes them.
- In `onActivate`, the source walks the session's zone registry and
  calls `measure()` on each zone's animated ref. It stores `pageX`,
  `pageY`, `width` and `height`. Only `pageX` and `pageY` share space
  with the gesture's `absoluteX` and `absoluteY`. Each rect clips to
  its nearest `MotionScrollView` viewport. The registry is a shared
  value, because a worklet captures a closure array at creation and
  would miss a zone that mounts later.
- `onUpdate` writes the finger to shared values and runs `hitZone`.
- Exactly one of drop or cancel runs per pickup. The bridge's
  `{ token, generation }` guard covers an unmount that races the
  finalize, and drops a stale measure.
- The ghost renders in `Overlay` at layer `dragGhost` (ADR 0040). It
  gets the session through props, because the overlay renders outside
  the screen's providers. Its animated style reads `x` and `y`.

#### Inside `internal/`

- Build each gesture config as one object literal. The worklets plugin
  rejects a spread inside a gesture hook's config object.
- Put `touchAction` in the gesture config, never on `GestureDetector`.
  The public config types omit the field, so one typed helper adds it.
  No other file names it.
- Only `src/components/motion/internal/` and the clocks in
  `src/lib/motion/progress.ts` call `scheduleOnRN`. Every surface
  reaches JS through the internal bridge.

#### `MotionScrollView`

- It renders gesture handler's `ScrollView` and gives its viewport rect
  to the zones inside it, for clipping.
- While its surface's drag is active, it freezes. On the web it adds a
  non-passive `touchmove` listener on `document` that calls
  `preventDefault`, and removes it at drop or cancel. On native it sets
  `scrollEnabled={false}`. Do not use `overflow: hidden`. The prototype
  showed that it stops the scroll, but the browser then cancels the
  drag, 20 times in 20.
- That listener is the one touch `addEventListener` lint allows.
- `renderMotionScroll` passes it to a `SectionList` or `FlatList` as
  `renderScrollComponent`.

### 5. Ban the old paths

Add these rules to `app/eslint.config.js`, next to the ADR 0039
boundary rules. Each message names ADR 0046.

In flat config, a later block that sets a rule replaces an earlier
block's options for every file that both blocks match. The config
already sets `no-restricted-syntax` for every file, with the ADR 0012
margin rule. It sets `no-restricted-imports` for `src/**`, with the
ADR 0037 `expo-file-system/legacy` rule, which
`src/lib/vault/adapters/saf.ts` skips. Merge the new entries into those
options, so both old rules still fire on every file they cover today.
The new blocks overlap too: a file in `src/features` needs the bans for
`src/**` and the bans for features in one list. Build each list from
shared constants.

In `src/features/**` and `src/app/**`:

- `no-restricted-imports`: `react-native-reanimated`,
  `react-native-worklets`, and every `react-native-gesture-handler`
  export except `Pressable`. `src/app/_layout.tsx` may also import
  `GestureHandlerRootView`.
- `no-restricted-imports`: any `@/lib/motion/*` path except `tokens`,
  `markLanded` from `entrances`, and `useProgress` and `Progress` from
  `progress`.

Everywhere in `src/**`:

- `no-restricted-imports`: `Animated`, `PanResponder`, `Pressable`,
  `TouchableOpacity`, `TouchableHighlight`,
  `TouchableWithoutFeedback` and `ScrollView` from `react-native`.
  `Gesture` from `react-native-gesture-handler`.
- `no-restricted-imports`: `@/components/motion/internal/*`, outside
  `src/components/motion`.
- `no-restricted-imports`, outside `src/lib/motion` and
  `src/components/motion`: `react-native-worklets`, the gesture hooks
  and `GestureDetector`.
- `no-restricted-imports`: `swipeProps` from `@/lib/swipe`.
- `no-restricted-syntax`: JSX attributes and object literal keys that
  match `/^onPointer(Down|Move|Up|Cancel)$/`. A JSX rule alone misses a
  spread handler object. The key rule catches the object where it is
  built, as in `use-drag-session.ts`.
  Use the selectors `JSXAttribute[name.name=/^onPointer(Down|Move|Up|Cancel)$/]`
  and `ObjectExpression > Property[key.name=/^onPointer(Down|Move|Up|Cancel)$/]`.
  A bare `Property[...]` selector, as in the margin rule, also matches
  destructuring and flags tests that only read a handler.
- `no-restricted-syntax`: `addEventListener` calls for touch events,
  except in `src/components/motion/scroll-view.tsx`.
- `no-restricted-syntax`: `AccessibilityInfo.isReduceMotionEnabled`.
- `no-restricted-syntax`: a `SectionList` or `FlatList` without
  `renderScrollComponent`.

Add a lint fixture test: one file that uses each banned import and
pattern, and a test that expects one error per line. The banned list
and the surfaces then cannot drift apart. The fixture also sets a
margin in a style and imports `expo-file-system/legacy`, and the test
expects both of those errors as well. The test lints the fixture text
with `ESLint.lintText` and its `filePath` option, once as a feature
file and once as a file on the allowlist below. On the allowlisted
path the motion errors go away, and the two old errors stay. A merge
that drops an old rule then fails the test.

An `ignores` list names today's users. Each port removes its own
entries, and the port that empties the list deletes it. Rerun this
search before you write the list, because files may move. It prints
every file under `app/src` that a rule above flags:

```sh
cd app/src && {
	rg -l -U --pcre2 \
		-e 'import\s*(type\s*)?\{[^}]*\b(Animated|PanResponder|Pressable|Touchable\w*|ScrollView)\b[^}]*\}\s*from\s*"react-native"' \
		-e 'from\s*"react-native-(reanimated|worklets)"' \
		-e 'import\s*\{[^}]*\b(Gesture|GestureDetector|use\w*Gesture)\b[^}]*\}\s*from\s*"react-native-gesture-handler"' \
		-e '"@/components/motion/internal' \
		-e '\bswipeProps\b' \
		-e '\bonPointer(Down|Move|Up|Cancel)\s*[=:]' \
		-e 'addEventListener\(\s*"touch' \
		-e '\bisReduceMotionEnabled\b' \
		-e '<(SectionList|FlatList)\b'
	rg -l --pcre2 'from\s*"@/lib/motion(?!/(tokens|entrances|progress)")' features app
} | sort -u
```

At commit `745976f` it prints 45 files, and the table lists exactly
those, as the search prints them. The last row is not an allowlist
entry, because this ticket swaps those files.

| Path under `app/src` | Owner |
|---|---|
| `lib/motion.ts` (step 1 moves it to `lib/motion/legacy.ts`) | the port that empties it |
| `components/swipe-pager.tsx`, `components/ui/tab-strip.tsx`, `features/lists/components/list-notices.tsx`, `features/planner/components/month-grid.tsx`, `features/planner/components/month-pane.tsx`, `features/planner/components/month-view.tsx`, `features/planner/components/period-strip.tsx`, `lib/swipe.test.ts`, `lib/swipe.ts` | 0059 |
| `features/lists/lists-screen.tsx` | 0059, then 0060 |
| `features/planner/components/day/day-spread.tsx` | 0059, then 0061 |
| `components/task-row.tsx`, `components/ui/card-group-row.tsx`, `features/lists/components/reorder-ghost.tsx`, `features/lists/components/reorder-row.tsx`, `features/lists/components/task-card-row.test.tsx`, `features/lists/components/task-card-row.tsx`, `features/lists/hooks/use-row-reorder.ts` | 0060 |
| `features/planner/components/day/overdue-group.tsx`, `features/planner/components/day/split-handle.tsx`, `features/planner/components/day/timeline-pane.tsx`, `features/planner/components/drag-ghost.tsx`, `features/planner/components/drag.tsx`, `features/planner/components/source-toggle.tsx`, `features/planner/components/task-list-section.tsx`, `features/planner/components/task-pills.tsx`, `features/planner/components/timeline.tsx`, `features/planner/components/week-view.tsx`, `features/planner/hooks/use-drag-session.ts`, `features/planner/hooks/use-split-pane.ts`, `features/planner/hooks/use-touch-drag-gate.ts` | 0061 |
| `components/bottom-bar/bottom-bar.tsx`, `components/ui/sheet.tsx`, `features/capture/components/capture-dock.tsx`, `features/capture/hooks/use-capture-sheet.ts` | 0062 |
| `components/bottom-bar/nav-tab.tsx`, `components/error-boundary.tsx`, `components/ui/button.tsx`, `components/ui/icon-button.tsx`, `components/ui/menu.tsx`, `components/ui/pill.tsx`, `components/ui/segmented-control.tsx`, `features/diagnostics/components/diagnostics-screen.tsx`, `features/task-editor/components/note-viewer.tsx` | 0058, swapped below |

`lists-screen.tsx` and `day-spread.tsx` stay listed after 0059. 0059
keeps the reorder's web handlers and the split's web resize on plain
views there, and 0060 and 0061 remove them.

No port touches the files in the last row, but each imports a banned
`Pressable` or `ScrollView`. Swap them in this ticket, with no change
in behavior. A press target inside a page or a drag source must be
gesture handler's `Pressable`, so the shared buttons swap first. A
scroller in a feature becomes `MotionScrollView`.

### 6. Swap the `Menu` entrance

`src/components/ui/menu.tsx` calls `useMenuEntrance` from
`legacy.ts`, which still runs React Native `Animated`. Rebuild it on
`menuEntering(corner)` and `useProgress`. The menu fades in and scales
from 0.92 to 1 over 140 ms from its anchor corner, with
`ReduceMotion.System`. The backdrop fades with it. Delete
`useMenuEntrance`, and keep `menu.tsx` off the allowlist.

### 7. Keep `README.md` current

Add `components/motion` to the Layout table in `README.md`, and say
that `lib/motion` holds tokens, pure math and clocks.

### Tests

Vitest, in node:

- `pager-math`: the commit threshold, a flick under the threshold, the
  rubber band and its cap, a closed end on each side, open `bounds`,
  and `visiblePages` at rest and mid-swipe.
- `drag-math`: a slot at each boundary, a zone outside its clip, a grid
  cell at each edge, a `null` grid cell, and `cardPosition` for first,
  middle, last and only.
- Landed mark: a second `takeLanded` of the same id finds nothing.
- `drag-machine` exactly once, in `src/lib/motion/drag-machine.test.ts`:
  - A `begin` during `settling` emits `flush`, then a new `pending`.
  - A `release` with `canceled: true` emits `cancel` and never `drop`.
  - Two sources begin. The first to `activate` owns the drag, and the
    second source's events are ignored until `settled`.
  - Every `pickup` is followed by exactly one `drop` or `cancel`.
  - A `finalize` from `pending` emits nothing.
- The bridge guard, in `src/components/motion/internal/bridge.test.ts`.
  Keep the guard pure, with no React import, so it runs in node:
  - A drop and an unmount race. `onDrop` or the cancel runs once.
  - A drop that carries an old generation is ignored.
  - A measure that lands after a newer pickup is dropped.

Component tests through the 0048 harness:

- `Pager` with three pages: a commit renders the screen at most once,
  and the live cell keys on `index`.
- `createDragSurface` with two zones: a pickup renders the root once,
  moves render nothing, and a drop calls `onDrop` once with the
  target's value.
- Computed `touch-action` on each host: `pan-y` on a `Pager` and on a
  `row` or `pill` source, `none` on a `grip` source. If gesture
  handler's web build cannot attach under jsdom, say so in the Outcome.
  The Playwright checks in 0059 to 0061 then carry it alone.
- `useProgress`: `onSettled` runs once per run, once at unmount, and
  not for a superseded run.
- With reduced motion, `timing` lands its end value at once and still
  runs `done`. 0060's tick hold depends on that callback.

Playwright:

- Add `expectTouchAction(locator, value)` to `app/e2e/gestures.ts`. It
  reads `getComputedStyle(el).touchAction` on the element. 0059 to
  0061 call it on each real host.
- Change `holdDrag` and `holdDragTo` in `app/e2e/gestures.ts` to
  pause the clock with `pauseClock`, press, call
  `page.clock.runFor(hold + 50)`, then move. Gesture handler's web long
  press is a `setTimeout`, and a paused clock stalls it until `runFor`
  steps past the hold. Today's `waitForTimeout(holdMs)` stops working
  once a spec pauses the clock.
- The `Menu` check runs in the `reduced-motion` project, which sets the
  flag before load. `page.emulateMedia` after load never reaches
  Reanimated, which reads the flag once.

### Native checks

Run these on the Android emulator with the `verify-monkey-tasks`
skill's Android path. Save the evidence folder under
`app/build/verify/evidence/android-<stamp>/` and name it in the
Outcome. Do these before 0059 starts, because the ports build on them:

- A `'worklet'` function runs on the UI thread, and a Reanimated
  animation runs with no native module error.
- `measure()` on zone refs read from the shared-value registry returns
  the zone rects inside a source's `onActivate`. If the registry cannot
  hold animated refs on native, zones measure themselves in a reaction
  at pickup. Record which one shipped in ADR 0046.
- `scrollEnabled={false}` on gesture handler's `ScrollView` stops the
  scroll and keeps an active drag.

## Acceptance

- [ ] `src/lib/motion.ts` moved to `src/lib/motion/legacy.ts` in its own
      first commit, and its five importers build.
- [ ] `package.json` lists `react-native-reanimated` 4.7.1 and
      `react-native-worklets` 0.13.0, and `npx expo install --check`
      passes. The repo has no `babel.config.js`.
- [ ] `src/lib/motion` holds `tokens.ts`, `progress.ts`, `entrances.ts`,
      `pager-math.ts`, `drag-math.ts` and `drag-machine.ts`, each pure
      file with a Vitest file.
- [ ] `src/components/motion` holds `pager.tsx`, `drag-surface.tsx`,
      `landing.tsx`, `scroll-view.tsx` and `internal/`, with the public
      signatures above.
- [ ] The `drag-machine` and bridge Vitest cases above pass: a begin
      during a settle, a cancel that never commits, two sources that
      claim once, a drop and unmount race, and a stale generation.
- [ ] Each surface host computes the `touch-action` from its hold
      table. `touchAction` appears only in the internal config helper,
      never on a `GestureDetector`.
- [ ] `MotionScrollView` freezes with a non-passive `touchmove`
      listener on the web and `scrollEnabled={false}` on native. No
      file sets `overflow: hidden` to freeze a scroller.
- [ ] Zone rects live in a shared value per session, in page
      coordinates (`pageX`, `pageY`), measured in `onActivate`.
- [ ] Lint fails on each banned import and pattern in the fixture file,
      and passes on the branch. The `ignores` list names only files that
      0059 to 0062 port. The ADR 0012 margin rule and the ADR 0037
      `expo-file-system/legacy` rule still fire on the feature path and
      on the allowlisted path.
- [ ] With reduced motion, `timing` lands at once and runs `done`, and
      `useProgress` runs `onSettled` with no clock time.
- [ ] The `Menu` entrance runs on Reanimated. In the `reduced-motion`
      project, a menu opens at full size with no scale frames.
- [ ] The native checks above pass on the emulator, and the Outcome
      names the APK run id and the evidence folder.
- [ ] `README.md` lists `components/motion` in its Layout table.

## Outcome
(filled in before moving to done/)
