# 0046. Motion lives in surfaces; features write no worklet

- **Status:** accepted
- **Date:** 2026-11-08

## Context

ADR 0036 moves every gesture and animation to the UI thread, on
Reanimated 4.7.1, worklets 0.13.0 and gesture handler 3.3.0. It says the
shared pieces live in `src/lib/motion`. It does not say what shape they
take. Ticket 0058 first sketched hooks: `usePager`, `useLongPressDrag`
with an `onMove` worklet, and a `drop-zones` registry. Tickets 0059 to
0062 port the screens onto whatever 0058 builds.

Three facts limit the shape:

- A worklet that calls a plain function works in the browser and
  crashes on the phone (ADR 0019). Lint cannot see it. Playwright runs
  the browser build, so no test catches it either.
- `src/lib` may not import `src/components` (ADR 0039). A drag ghost
  needs `Overlay`, and a reorder row needs the card shape from
  `components/ui/card-group-row`.
- Most of the 21 bugs that tickets 0059 to 0062 list start at a call
  site. A callback reads stale state, a layout effect resets an offset,
  a timer runs beside an animation, a `touchAction` is missing, or a
  React Native `Pressable` ignores the pan that should cancel it.

On 2026-11-08 an architect run built two candidates against the 0059 to
0062 call sites.

**Hooks.** Public hooks return a gesture and shared values. A pager
needs `usePager` and a view that places its six handles. A drag source
needs `useDragSource`, a `GestureDetector`, and an animated style for
its tint and shake that the feature writes. That is about 18 public
names. The candidate's own review listed 7 rules a caller must
remember. Two fail with no error. A forgotten zone ref makes a dead
zone. A plain function inside a feature's animated style is the ADR
0019 crash. By its own count, 11 bugs became impossible by
construction.

**Surfaces.** Five components or factories own the gesture, the
`touchAction`, the hold cue, the ghost, measuring, hit testing and every
thread crossing. A feature passes data and plain functions. By its own
count, 15 bugs and the split's first frame became impossible by
construction.

A prototype on the web build then checked the facts the design rests
on. The facts section below lists the results.

## Decision

We build motion as surfaces. Features and routes write no worklet, and
lint makes that a build error.

- `src/components/motion/` holds the surfaces: `Pager`,
  `createDragSurface`, `createReorderSurface`, `Split`, `Landing` and
  `MotionScrollView`. Its `internal/` folder holds the session engine,
  the source gesture and the JS bridge. Only files in
  `src/components/motion` import `internal/`.
- `src/lib/motion/` holds the tokens, the pure worklet math
  (`pager-math`, `drag-math`, `drag-machine`), `progress.ts` with
  `timing`, `spring` and `useProgress`, and `entrances.ts` with the
  landed mark and the menu entrance.
- In `src/features` and `src/app`, lint bans imports from
  `react-native-reanimated` and `react-native-worklets`. From
  `react-native-gesture-handler` it allows only `Pressable`, plus
  `GestureHandlerRootView` in `src/app/_layout.tsx`.
- A surface takes its policy as data: a `hold` kind (`row`, `pill` or
  `grip`), page `bounds`, a zone's `target`, grid `cells`, a row's
  `group`, `index` and `count`, and the split's `minTop` and
  `minBottom`.
- The surfaces own the look of a hold, a lift, a shake and a hover
  tint. Lists and Planner share one look, and no surface takes a style
  prop for it. The owner chose this on 2026-11-08.
- `useProgress` is the one clock that React drives. The menu, the
  tick, the landing and the capture sheet use it.

This replaces one line of ADR 0036. The shared pieces live in
`src/components/motion` and `src/lib/motion`. Only
`src/components/motion/internal/` and the clocks in
`src/lib/motion/progress.ts` call `scheduleOnRN`. Every surface reaches
JS through the internal bridge.

We chose surfaces on two criteria: how much a caller must learn, and
how safe a copied call site is. Four port tickets and later agents copy
the nearest example. A surface call site cannot reach the ADR 0019
crash, because it holds no worklet. A hooks call site can.

## Facts the design rests on

The prototype ran on 2026-11-08 on the web build: Reanimated 4.7.1,
worklets 0.13.0, gesture handler 3.3.0 and react-native-web 0.21.4. Each
cell ran 10 times.

- Gesture handler's web `Pressable` does not fire when a parent pan
  activates, with the mouse and with CDP touch (10 of 10 in each
  cell). React Native's `Pressable` still fires after a mouse swipe,
  after a mouse hold then a drag, and after a touch hold with no move
  (10 of 10). After a touch hold then a swipe, it does not fire. So
  only gesture handler's `Pressable` cancels in every case. `onPressIn`
  and `onPressOut` still fire before the cancel.
- A paused Playwright clock drives Reanimated's web frame loop. The
  value stays put through 500 ms of real time and moves only when
  `page.clock.runFor` steps it. The paused clock also stalls gesture
  handler's long press. It was not active after 800 ms of real time,
  and it was active after `runFor(350)` (10 of 10).
- With reduced motion, `withTiming` lands at once and calls back in the
  same call with `finished: true` (10 of 10).
- `overflow: hidden` on the web scroller stops the scroll, but the
  browser then cancels the drag (20 of 20). A non-passive `touchmove`
  listener on `document` that calls `preventDefault` while a drag is
  active stops the scroll and keeps the drag (20 of 20).
- `measure()` in a source's `onActivate`, on sibling zone refs, found
  the right zone with a rect error of 1 px or less, at scroll offsets 0
  and 200 (10 of 10). Only the `pageX` and `pageY` fields share client
  space with the gesture's `absoluteX` and `absoluteY`. On the web, a
  shared-value registry of zone refs and a captured array gave the same
  rects. On native, a worklet captures a closure array at creation, so
  zones register in a shared value.
- The worklets plugin rejects a spread inside a gesture hook's config
  object.

Gesture handler 3.3.0 drops the `touchAction` prop of `GestureDetector`
on the web. With the prop set to `pan-y`, the host's computed
`touch-action` reads `none`. With `touchAction` in the gesture config,
it reads `pan-y`. The source lines, under the package's `src/`:

- `v3/hooks/useGesture.ts`, lines 96 to 98. An effect sends the whole
  config through `setGestureHandlerConfig` on each config change.
- `RNGestureHandlerModule.web.ts`, lines 73 and 74. On the web, that
  call runs the handler's `setGestureConfig`.
- `web/handlers/GestureHandler.ts`, lines 791 to 793. `setGestureConfig`
  calls `resetConfig()` first. Lines 953 to 966: `resetConfig()` sets
  `_touchAction` to `undefined`.
- `v3/detectors/HostGestureDetector.web.tsx`, lines 125 to 129. The
  detector sends its `touchAction` prop when it attaches a handler, so
  the hook's config effect wipes it.
- `web/tools/GestureHandlerWebDelegate.ts`, lines 274 to 285. An enabled
  handler with no `touchAction` sets `touch-action: none`.

The config field passes the native filter
(`v3/hooks/utils/propsWhiteList.ts`, line 44). The public config types
omit it: `ExcludeInternalConfigProps` (`v3/types/UtilityTypes.ts`,
lines 29 to 32) drops every key of `InternalConfigProps`, which holds
`touchAction` (`v3/types/ConfigTypes.ts`, line 58). So one typed helper
in `src/components/motion/internal/` adds the field, and no other file
names it.

## Consequences

The port tickets become call site work. A screen picks a surface,
passes data and callbacks, and deletes its old gesture code. These bugs
become impossible for a caller who uses a surface as shown: V1, V2, V3,
V8, V10, V11, V12, J2, J3, L2, L3, B1, B2 and the split's first frame.
V4, V7, J1 and L1 are half surface and half feature work. J4 moves onto
one clock in `useProgress` and the `Sheet` primitive. V5, V6 and V9
stay feature work. Each port ticket names its share.

We accept these costs:

- A feature cannot write a custom gesture or animation. A new kind of
  motion needs a new surface in `src/components/motion`.
- The surfaces own the hold tint, the shake, the hover tint and the
  lifted look. A screen that wants another look changes the surface for
  every screen.
- `Reorder.Item` owns the card corners and the divider in a reorderable
  list. `cardPosition` moves from `components/ui/card-group-row` to
  `lib/motion/drag-math`, because the UI thread needs it.
- Scrollers freeze while a drag is active, so rects measured at pickup
  stay true. Edge auto-scroll is out of scope.
- The live page remounts at each landing, because it keys on its index.
  The landed page then mounts at its top, as its preview drew it.
- A page jump of more than one page cuts with no slide, so the pages
  between never mount.
- Reanimated reads reduce motion once, at load. Today's
  `useReduceMotion` follows the switch live. That goes away.
- `onReorder` must update the rendered order in the same tick. A late
  write still ends right, but its rows slide back and then jump.

Some facts still need native proof. Ticket 0058 runs them on the
Android emulator path from ticket 0073: `measure()` on shared-value zone
refs, the scroll freeze with `scrollEnabled`, and the reorder drop with
no blink. Feel and refresh rate on real hardware stay a phone check.

## Alternatives

**Hooks that return gestures and shared values.** Candidate one, and
the first 0058 sketch. It hides the state machines and the crossings,
but every caller wires the detector, the ghost and the tint. Every
feature that tints writes a worklet. It lost on depth and copy safety.

**The first 0058 API as written.** `useLongPressDrag` with an `onMove`
worklet, a separate `drop-zones`, and `canGo` as a function. It puts a
worklet in feature code and splits the hover from the finger across two
modules. Both candidates dropped it.

**One drag surface with a pluggable policy worklet.** The policy is a
feature worklet, which is the ADR 0019 crash. Reorder also needs styles
per row that a zone surface lacks.

**Surfaces in `src/lib/motion`.** The layer rule forbids it, because
the ghost needs `Overlay` and the reorder row needs the card shape.

## Amendment, 2026-11-08: what ticket 0058 found

Ticket 0058 built the engine, `createDragSurface`, `Pager`, `Landing`
and `MotionScrollView`, and ran the native checks on the Android
emulator. APK run 42496388537 built commit `6538d60`. The evidence is in
`app/build/verify/evidence/android-20261108-161103/`.

- The zone registry shipped as written. Zones keep their animated refs
  in one shared value per session, and `measure()` reads them in the
  source's `onActivate`. On the emulator a held chip dropped on the box
  under the finger, at scroll offset 0 and after a scroll of 176 px.
  The fallback, zones that measure themselves at pickup, was not needed.
- `scrollEnabled={false}` holds the scroller during a drag, and the drag
  goes on. The boxes kept their bounds through a 377 px vertical drag. A
  quick swipe that starts on a row source still scrolls and lifts
  nothing.
- Worklets run on the UI thread with no native module error. `measure()`
  returns nothing on the JS thread, so each drop proves its pickup ran on
  the UI thread. The menu opens on a Reanimated keyframe.
- On the web, the `touchmove` freeze keeps a touch drag alive. With the
  listener removed, the same Playwright drag lost its drop in both
  projects.

Two facts change how the surfaces apply:

- Gesture handler 3.3.0's web `Pressable` presses only a view whose role
  is `button` (`web/handlers/NativeViewGestureHandler.ts`, lines 87 to
  92). A tab, a segment or a menu item keeps its own role, so it presses
  with `NoPanPressable` in `components/ui`. That is gesture handler's
  `Pressable` on native and React Native's on the web. None of these
  targets sits under a pan.
- Under jsdom, gesture handler's web `Pressable` never fires, by pointer
  or by key. Component tests swap in React Native Web's `Pressable` in
  `src/testing/dom-setup.ts`. The Playwright suite presses the real one.
  The pan surfaces do run under jsdom, so their component tests drive
  gesture handler with pointer events.

## Amendment, 2026-11-10: a press with no pan above it keeps its press

The verifier of PR #97 found that gesture handler's web `Pressable`
drops a press when the view re-renders under the finger. Under six
browsers at once, the retry button of a write banner lost 15 presses
of 120. React Native's `Pressable` lost none. The pointer down, up and
click all reached the button, so the button did not move. The handler
let the press go on its own. The same press turned the `vault` e2e
spec red in 2 runs of 5.

A banner re-renders while a finger rests on it. A failed write lands,
or the app returns to the foreground. A press must still run.

A press target with no pan above it now takes React Native's
`Pressable` on the web. `components/ui/pressable.tsx` exports it as
`NoPanPressable`. That holds a Button, a tab, a segment and a menu
item, so it replaces `RolePressable`. A target inside a pager or a
drag source keeps gesture handler's `Pressable`, because a pan must
cancel the press. This refines the fact above that calls gesture
handler's press the only one that cancels in every case.

Alternative: keep every press on gesture handler and wait for the
library. The library sits outside the repo, and the repo can hold the
right press today.

Test: the `vault` e2e spec presses Retry right after a failed tick. At
head it went red in 2 runs of 5 under six browsers. The fix lost no
press in 120, and the spec stayed green.

## Amendment, 2026-11-10: every press takes the browser click

The amendment above left every press under a pan on gesture handler's
`Pressable`. That press fires from pointer up, and its web build first
checks the press against the view's layout report. Before that report
the box is 0 by 0, and a tap at the middle of the target fails
`isTouchWithinInset`. A row that mounts after a drop can be tapped in
that frame. The tap does nothing.

The same press is bound to the node that took the pointer down. A view
that mounts or is replaced under the finger loses it. The lists screen
left this class in the amendment above. The planner rows and the
reorder rows stayed on it because a pan must cancel their press.

Reproduced on the head before the fix with a tap in the row's first
layout frame: pointer down, pointer up and the browser click in the
same task as the row's mount. The row did not tick, and a tap on a row
that had reported layout did. Under load, a tap in the drop's frame
lost 1 press of 80 on head. A tap 100 ms after the drop lost none in
240 across six browsers, because the report had usually landed by
then.

Every press target now takes React Native's `Pressable` on the web,
exported as `Pressable` from `components/ui/pressable.tsx`. That
covers a Button, a row, a tab, a segment, a menu item and a planner
cell. It fires from the browser's click, which goes to the element
under the pointer at release. A row that mounts or re-renders under
the finger still presses, and no layout report is needed.

A press must still not run on a drag. Two rules keep it off:

- A pointer that travels more than the hold's slop (8 px) from its
  press drops the press. The old press cancelled on pointer leave,
  and a browser click does not.
- A pan that activates arms a one-shot guard for its surface, in
  `components/motion/internal/press-cancel.ts`. The guard stops the
  next click at `window` capture, however late the browser sends it.
  It disarms on that click, or on the next pointer or key down, which
  is a new gesture. A drag that makes no click leaves it armed until
  that next press, so a late click is never missed and no window
  blocks a later tap (V10). `createDragSurface`, `createReorderSurface`,
  `Pager` and `Split` each own one guard.

Alternative: remove the layout gate from gesture handler's web press.
The gate sits inside the installed library, and the press still binds
to the node that took the pointer down. A row that mounts or is
replaced under the finger would still lose it. The native path keeps
gesture handler's `Pressable`, where a pan cancels the press itself.

Tests: `e2e/specs/press.spec.ts` presses a captured row in its first
layout frame, and holds a tick in place with the mouse and with CDP
touch. The first failed on head and passes at the fix. The planner's
"a tap 100 ms after a drop still ticks the row" passed 20 of 20 runs.
At the fix the six-browser load lost no press in 120 immediate taps
and none in 240 taps at 100 ms. The two-frame press wait in
`e2e/locators.ts` and the capture settle wait in `reorder.spec.ts` are
gone. The press no longer needs either.

A device would still prove the native half: gesture handler's press
cancels under a pan with no click tail, and Enter and Space press on a
hardware keyboard. No emulator ran here.

## Amendment, 2026-11-11: the live page lays out at the track's origin

On Android, every list tab except the first was missing from the
accessibility tree. The rows, the repair banner and the empty state
painted, but uiautomator and TalkBack read nothing. Ticket 0079 records
the evidence.

`Pager` had put the live page at `left: live * 100%` and carried the
page position in the track's transform. With `live` above 0 the page
laid out outside the host's clip. Android's virtualized list clips its
rows against that box, so the rows left the native view tree. The
browser paints the translated page at the same pixels, so the web
suite and axe could not see it.

The live page now lays out at the track's origin. Only the transform
carries the position, measured against the live page, and a preview
sits at `(rel - live) * 100%`. A page's layout stays inside the host at
rest, and the painted motion does not change.

Alternative: keep the layout and accept the loss on Android. A screen
reader user could not read any list but the first, so that was not
available.

Proof: `pagers.spec.ts` reads the live page's layout offset on a
non-first tab, 1200 px before the fix and 0 after. The emulator, with
the release APK of `bd15a24`, reads the rows and banners on Errands
and Focus, and the lists swipe journey passes end to end.
