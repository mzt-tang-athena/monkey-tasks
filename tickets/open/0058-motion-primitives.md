---
id: 0058
title: Motion primitives on Reanimated and gesture handler hooks
created: 2026-10-26
priority: high
assignee:
pr:
depends: [0055, 0056, 0057]
---

## Spec

Epic 0047, phase 4. ADR 0036 decides that motion runs on the UI thread.
This ticket adds the libraries and builds the shared pieces in
`src/lib/motion`. Tickets 0059 to 0062 port the screens onto them. This
ticket changes no screen. It swaps one primitive's motion: ticket 0054
leaves the `Menu` entrance (today `features/planner/PlannerScreen.tsx:64-84`)
behind a hook for this ticket.

Read first: ADR 0036, then ADR 0033 (pager) and ADR 0032 (reorder).
The paths below are the homes after phase 3. Today's paths appear only
where a bug or a function moves.

### 1. Add the libraries

Run this in `app/`:

```sh
npx expo install react-native-reanimated react-native-worklets
npx expo install --check
```

The first command pins the SDK 58 versions, `react-native-reanimated`
4.7.1 and `react-native-worklets` 0.13.0. Both sit in `node_modules`
today only as transitive packages (`npm ls react-native-reanimated`
shows expo-router and the keyboard controller). The check must pass.

Add no Babel config. `babel-preset-expo` 58.0.18 adds
`react-native-worklets/plugin` whenever that package resolves
(`app/node_modules/babel-preset-expo/build/configs/expo.js`, lines 104
to 111). Do not add `react-native-reanimated/plugin` as well; Reanimated
4 uses the worklets plugin. Wrap the Metro config with
`wrapWithReanimatedMetroConfig` from `react-native-reanimated/metro-config`
so worklet errors carry readable stacks.

The 0048 harness renders components through react-native-web in jsdom.
Load Reanimated's web build there. If it fails under jsdom, alias
`react-native-reanimated` to `react-native-reanimated/mock` for
component tests only, and assert end states. Reanimated 4.7.1 exports
`setUpTests`, `withReanimatedTimer` and `advanceAnimationByTime`
(`src/index.ts`, lines 169 to 172).

### 2. Rebuild the dev client

Autolinking already lists both modules
(`npx expo-modules-autolinking react-native-config --platform android`).
The APK on the phone may predate that, and JS that imports Reanimated
crashes on an APK without it. Build from the branch:

```sh
cd app && eas build --profile development --platform android
```

Install it, open the app, and record the build id in the Outcome.
Every phone check in 0059 to 0062 runs on this build or a later one.

### 3. Build `src/lib/motion`

| File | Contents |
|---|---|
| `tokens.ts` | Durations: tap 120, return 180, settle 220, landing 220, wash 600, sheet 220. `easeOut` as Reanimated `Easing.bezier(0.16, 1, 0.3, 1)`. Swipe: slop 12 px, commit 80 px, flick 500 px/s, rubber band 0.28 of travel capped at 48 px. Holds: row 300 ms, pill 120 ms, drag slop 8 px. The drag values move here from `theme/tokens` (`drag`). |
| `reduce-motion.ts` | Re-export `useReducedMotion` from Reanimated. `timing(to, ms, done?)` and `spring(to, config, done?)` worklet helpers that always set `reduceMotion: ReduceMotion.System`. |
| `pager-math.ts` | Pure: `follow(dx, canGo)` returns the finger travel or the rubber band. `releaseTarget({ dx, vx, canPrev, canNext })` returns -1, 0 or 1. `visiblePages(pos, width)` returns the track positions on screen. |
| `drag-math.ts` | Pure: `slotForY(y, rects)` (today `app/(tabs)/index.tsx:417-427`), `slotTops(order, rects, gap)` (today `layoutOrder`, `features/lists/reorder.ts:48-61`), `hitZone(x, y, zones, clip)` (today `lib/dropzone.ts:77-97`). |
| `use-pager.ts` | The pager hook, below. |
| `use-long-press-drag.ts` | The drag hook, below. |
| `drop-zones.ts` | Zone registry: `register(id, ref)`, `measureAll()` on the JS thread, rects and the hovered id in shared values, and `useZoneStyle(id)` for the hover tint. |
| `entrances.ts` | The landed mark (`markLanded(id)`, `takeLanded(id)`), the `landing` entering animation, and `useWash()`. |

Every function in the pure files starts with `'worklet';` and imports
nothing from React, react-native or Reanimated. The directive is a
plain string under Vitest, so one function runs on the UI thread and in
a unit test. Each pure file has a Vitest file beside it.

#### `usePager`

```ts
usePager({
  index: number,                      // live page's position on the track
  canGo: (dir: -1 | 1) => boolean,    // JS, mirrored to shared values per render
  onPage: (next: number) => void,     // JS, after a settle completes
  onVisible: (pages: number[]) => void, // JS, once per change
}): { gesture, trackStyle, onLayout, width, goTo: (next: number) => void }
```

- The gesture is `usePanGesture` with `activeOffsetX: [-12, 12]`,
  `failOffsetY: [-12, 12]` and `touchAction: 'pan-y'`. The hooks
  forbid `minDistance` beside offsets (`src/v3/hooks/gestures/pan/usePanGesture.ts`,
  lines 62 to 74). Its callbacks are `onBegin`, `onActivate`,
  `onUpdate`, `onDeactivate` and `onFinalize`, and the event carries
  `translationX`, `velocityX` and `absoluteX`.
- One shared value `pos` holds the track offset in px. The track's
  transform is `translateX: -pos`. A cell sits at `left = page * width`,
  a React prop. A commit changes React props only, and `pos` already
  equals the target, so no reset races the commit (ADR 0036, rule 1).
- The release springs `pos` with the gesture's `velocityX` and calls
  `onPage` from the completion callback through `scheduleOnRN`.
- A touch during a settle stops the spring and commits the pending
  target at once. The finger then drags from where the track stands.
  Two fast flicks move two pages.
- `onVisible` fires when the set of track positions on screen
  changes, never per move.
- `goTo(next)` animates the track to `next` the same way. A tab tap
  and a strip tap use it.

#### `useLongPressDrag`

```ts
useLongPressDrag({
  holdMs: number,                    // 0 for a grip
  onPickup: (x: number, y: number) => void, // JS, once, after the hold
  onMove?: (x: number, y: number) => void,  // worklet, every move
  onDrop: () => void,                // JS, once
  onCancel?: () => void,             // JS, once
}): { gesture, hold, x, y }          // hold: 0..1 shared value for the cue
```

- A row uses `usePanGesture` with `activateAfterLongPress: holdMs`. The
  pan fails when the finger moves before the hold ends, so a scroll
  keeps the touch. A grip uses `minDistance: 0`.
- The hold cue is the shared value `hold`, driven from `onBegin` and
  reset in `onFinalize`. It never sets React state, so a scroll that
  starts on a row costs no render.
- `x` and `y` follow the finger on the UI thread. The ghost reads them
  through `useAnimatedStyle`.
- Exactly one of `onDrop` and `onCancel` runs per pickup.
- Feature code passes plain functions. The hook alone calls
  `scheduleOnRN`, so no feature worklet calls app code.
- A press target inside a pager page or a drag source uses gesture
  handler's `Pressable` (a version 3 export). The orchestrator then
  cancels the press when a pan or a drag activates, on the phone and
  in the browser. No timed click guard is needed.
- In the browser, a source sets `touchAction: 'pan-y'`, so a touch can
  scroll before the hold ends. A CDP touch test checks that the pane
  stops scrolling once the drag activates. If the pane still scrolls,
  the hook adds a non-passive `touchmove` listener that calls
  `preventDefault` while a drag is active. Today's guard shows the
  pattern (`features/planner/hooks/useTouchDragGate.ts:61-86`). That
  listener is the one allowed touch `addEventListener` in the app.

### 4. Ban the old paths

Add rules to `app/eslint.config.js`, next to the 0050 boundary rules:

- `no-restricted-imports`: `Animated` and `PanResponder` from
  `react-native`, and `Gesture` from `react-native-gesture-handler`.
- `no-restricted-syntax`: JSX attributes that match
  `/^onPointer(Down|Move|Up|Cancel)$/`, and `addEventListener` calls
  for touch events.

An `ignores` block lists today's users at their phase 3 paths. Before
phase 3 they sit at `app/(tabs)/index.tsx`, `components/BottomBar.tsx`,
`components/SwipePager.tsx`, `components/TaskRow.tsx`,
`features/capture/components/CaptureSheet.tsx`,
`features/lists/ReorderRow.tsx`, `lib/motion.ts`, `lib/swipe.ts`, and
in `features/planner` the files `PlannerScreen.tsx`,
`hooks/usePlannerGestures.ts`, `hooks/useTouchDragGate.ts` and the
components `DaySpread.tsx`, `drag.tsx`, `TaskListSection.tsx`,
`TaskPills.tsx`, `Timeline.tsx` and `WeekView.tsx`. Tickets 0059 to
0062 each remove their own entries. The ticket that empties the list
also deletes it.

### 5. Swap the `Menu` entrance

The `Menu` primitive from 0054 calls an entrance hook that still runs
React Native `Animated`. Rebuild that hook on `entrances.ts`: the menu
fades in and scales from 0.92 to 1 over 140 ms from its anchor corner,
with `ReduceMotion.System`. The backdrop fades with it. Remove the
`Menu` file from the allowlist.

## Acceptance

- [ ] `package.json` lists `react-native-reanimated` 4.7.1 and
      `react-native-worklets` 0.13.0, and `npx expo install --check`
      passes.
- [ ] The repo has no `babel.config.js`, and a `'worklet'` function
      runs on the UI thread on the phone.
- [ ] A dev client built from the branch runs a Reanimated animation
      on the phone with no native module error. The Outcome records the
      build id.
- [ ] `src/lib/motion` holds the eight files above, with kebab-case
      names and imports through `@/lib/motion/...`.
- [ ] Vitest covers `pager-math`, `drag-math` and the landed mark:
      threshold, flick, rubber band, clamp at an end, slot at each
      boundary, a zone outside the clip, and a mark that a second
      take does not find.
- [ ] A jsdom component test drives `usePager` and `useLongPressDrag`
      through the 0048 harness, or the Outcome records why the mock
      replaced the web build.
- [ ] With reduce motion on, a `timing` helper lands its end value at
      once and still runs its completion callback. A test proves it,
      because the tick hold in 0060 depends on that callback.
- [ ] Lint fails on a new `Animated`, `PanResponder`, `Gesture.Pan()`
      or `onPointerMove` outside the allowlist, and passes on the
      branch.
- [ ] The `Menu` entrance runs on Reanimated. With reduce motion
      emulated in Playwright, a menu opens at full size with no scale
      frames, and on the phone it opens without a scale.

## Outcome
(filled in before moving to done/)
