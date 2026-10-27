# 0036. Motion runs on the UI thread

- **Status:** accepted
- **Date:** 2026-10-26

## Context

The app moves things with React Native `Animated` and reads touches in
three ways. The tab, day and month swipes use a `PanResponder` tripwire
(ADR 0018). The row drags and the split grabber use the gesture handler
builder API with `runOnJS(true)` (ADR 0019). The browser preview has
its own pointer handlers. Every move event crosses to the JS thread.
Some of them set React state, and timers decide when a page, a hold or
a click guard ends.

An audit on 2026-10-26 found 12 visible glitches, 4 sources of jank
and 3 latent faults. Tickets 0059 to 0062 list each one with its file
and line. Most share three causes:

- A React commit and a native animated reset must land in the same
  frame, and nothing makes them do so.
- A gesture sets React state mid-flight, so a whole screen re-renders
  while the finger moves.
- A timer runs beside an animation, so rapid input races it.

The libraries for the standard fix already sit in `app/node_modules`:

- Reanimated 4.7.1 and Worklets 0.13.0 arrive through expo-router and
  through the keyboard controller's peer dependency. Expo SDK 58
  bundles these exact versions.
  `npx expo-modules-autolinking react-native-config --platform android`
  lists both, so the native build links them today.
- Reanimated 4.7 supports React Native 0.86 to 0.88 with Worklets 0.13
  (`react-native-reanimated/compatibility.json`).
- `babel-preset-expo` 58 adds `react-native-worklets/plugin` whenever
  that package resolves (`babel-preset-expo/build/configs/expo.js`,
  lines 104 to 111). The app needs no Babel config of its own.
- Gesture handler 3.3 ships a hooks API: `usePanGesture`,
  `useNativeGesture`, `useSimultaneousGestures` and the relation props
  `simultaneousWith`, `requireToFail` and `block`. A hook keeps one
  handler tag for the life of the component and pushes config changes
  to it (`src/v3/hooks/useGesture.ts`, lines 32 and 86 to 108).
- The worklets plugin turns the callbacks passed to these hooks into
  worklets (`gestureHandlerObjectHooks` in `react-native-worklets/plugin`).
  `runOnJS: true` keeps them on the JS thread
  (`src/v3/hooks/useGestureCallbacks.ts`, lines 56 to 62).
- On the web the gesture handler captures the pointer
  (`src/web/tools/PointerEventManager.ts`, line 43). Reanimated has a
  web build. Both work with react-native-web.

ADR 0018 says a gesture handler on the parent of a scrolling list never
sees the moves on Android. The library source says otherwise. The root
view hands every `MotionEvent` to the orchestrator before the view tree
(`RNGestureHandlerRootView.kt`, lines 52 to 70). It cancels JS callback
handlers only when a native view calls `requestDisallowInterceptTouchEvent`
(`RNGestureHandlerRootHelper.kt`, lines 119 to 132). A vertical scroller
makes that call only when it starts a vertical scroll. The pan that
commit `f803a65` removed had no `runOnJS(true)` and called `setTab`
inside a worklet. ADR 0019 found eight hours later that such callbacks
threw. Its `failOffsetY` of 24 against an `activeOffsetX` of 80 also
failed most thumb swipes.

## Decision

We run every animation on Reanimated shared values on the UI thread.
We read every touch through gesture handler 3 hooks, on the phone and
in the browser alike. Worklets call app code only through
`scheduleOnRN`, and only at a pickup, a drop or a page commit. The
shared pieces live in `src/lib/motion`.

Four rules follow:

1. A commit never needs a shared value reset in the same frame as a
   React commit. Positions that change at a commit come from React
   props, so the commit carries them.
2. A gesture writes no React state per move. State changes at a
   pickup, a drop or a commit.
3. An animation's completion callback ends a hold or a page, never a
   timer.
4. Every animation passes `ReduceMotion.System`, and every component
   reads the switch through Reanimated's `useReducedMotion`.

We retire the `PanResponder` tripwire, the browser pointer handlers,
the builder API, and React Native `Animated`. Ticket 0058 bans them
with a lint rule and an allowlist of today's users. Tickets 0059 to
0062 empty the allowlist.

## Consequences

Frames hold while the JS thread renders a page or writes a note. The
browser preview runs the same gestures as the phone, so Playwright can
prove most of the motion before a phone pass. Three timers go away:
the 250 ms neighbour drop, the 250 ms tick hold and the 350 ms click
guard.

The costs:

- The dev client needs a rebuild from the branch. JS that imports
  Reanimated crashes on an APK without it.
- A worklet that calls app code throws at run time, the same crash
  as ADR 0019. Lint does not catch it. The primitives own every
  `scheduleOnRN` call, and feature code passes plain callbacks.
- Vitest cannot run a worklet. We keep each decision (thresholds,
  slots, hit tests) as a pure function and test those in Vitest.
- In the browser, Reanimated runs on the main thread. A native
  gesture cannot block a browser scroll, so pagers and drag sources
  set `touchAction` instead.
- The reorder drop still hands a reset from the UI thread to a React
  commit. Ticket 0060 settles that on a phone before the port.

## Alternatives

**Fix each bug in place on React Native `Animated`.** Each fix is
small. The three input paths, the per-move JS hops and the
cross-thread resets would stay, and the next motion change would meet
the same races.

**`react-native-pager-view` for the three pagers.** SDK 58 bundles
9.0.7. It has no web build, and the browser preview is where we prove
motion first. It also mounts each page as a child with its own
scrolling list, which ADR 0033 rejected.

**Gesture handler hooks with `runOnJS: true` everywhere.** This
removes the builder API but keeps every move on the JS thread.

## Amendment, 2026-10-27: libraries checked

Before phase 4 we checked whether a library could replace each
in-house primitive. None can. The versions and issues below are as of
this date.

| Need | Checked | Why not |
|---|---|---|
| Reorder | react-native-reorderable-list 0.18, react-native-sortables 1.10, react-native-draggable-flatlist 4.0, react-native-drax 1.1 | None reorders rows inside sections in a pager. None has accessibility actions, which ticket 0063 needs. Draggable-flatlist crashes on React Native 0.87 and later. Sortables does not virtualize. Each one has web support that is untested or broken. |
| Pager | react-native-tab-view 4.3, react-native-reanimated-carousel 5.2 | Tab view runs `PanResponder` and React Native `Animated` on the web, and this ADR removes both. The carousel sets one height for every page, but ADR 0033 needs the live page to set it. |
| Drag to schedule | @howljs/calendar-kit 2.5, react-native-big-calendar 4.19 | Neither accepts a drag from a list, a pill or a month cell. |
| Capture sheet | @gorhom/bottom-sheet 5.2 | On Android it moves only after the keyboard has finished, from a JS event. Ticket 0062 needs the sheet to move with the keyboard on every frame. |

The libraries still show patterns we copy. Tickets 0058, 0060, 0061
and 0062 name each one with its source.
