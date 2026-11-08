---
id: 0062
title: The capture sheet and the bar move on one clock
created: 2026-10-26
priority: normal
assignee:
pr:
depends: [0058]
---

## Spec

Epic 0047, phase 4. ADR 0036, its amendment to ADR 0021, and ADR 0045
decide this. ADR 0021 says the sheet and the keyboard share one clock.
They do not. This ticket puts the sheet, the dock and the bar on one
`useProgress` from 0058, and rides the keyboard on the UI thread. Paths
are on `epic/0047-rebuild` at commit `1d85cc3`, under `app/src`.

### Design, 2026-11-08

This spec follows the 2026-11-08 design package for phase 4. ADR 0045
records it. What matters here:

- `useProgress(target, { ms, onSettled })` is the one clock that React
  drives. It returns a branded read-only `Progress`. Feature code passes
  it along and cannot write it.
- `onSettled(at)` runs once per run, or at unmount. A reversal before
  the end supersedes the run, and its `onSettled` never runs. So a
  reopen during the exit cancels the unmount with no extra code.
- With reduced motion, `useProgress` holds its end value from the first
  frame. The prototype showed `withTiming` landing at once with
  `finished: true` under reduced motion, 10 runs in 10.
- The capture hook is feature code, so it imports only `useProgress`
  and `Progress`. The `Sheet` and the bar are shared components, so
  they may read the value in animated styles.

### What breaks today

| Bug | Today | What the user sees |
|---|---|---|
| J4 | `features/capture/hooks/use-capture-sheet.ts:100-151` runs one 220 ms `Animated.parallel` on the JS driver for the sheet's `expand` and the bar's `lift`. It animates layout props (`components/bottom-bar/bottom-bar.tsx:59-69`). The keyboard height comes from `useKeyboardAnimation` (`components/ui/sheet.tsx:113`), a native value on its own curve. The send also inserts a row on the JS thread in the same frames. | The sheet stutters, or drifts against the keyboard, on open and on send. |
| L1 | `use-capture-sheet.ts:117-151` ignores reduce motion. | The sheet fades and scales with reduce motion on. |

### What the design makes impossible, and what stays here

By construction:

- L1. `useProgress` passes `ReduceMotion.System`. Lint bans
  `AccessibilityInfo` motion reads.
- The unmount race. A reopen supersedes the exit run, so its
  `onSettled(0)` never unmounts the sheet.
- The second clock in `Sheet` (review note below). `Sheet` takes
  `progress` and has no clock of its own.

J4 stays this ticket's work, inside `Sheet` and the bar. One value
drives the sheet, the scrim and the bar. The `Sheet` rides the keyboard
on the UI thread.

### The change

- `useCaptureSheet` calls
  `useProgress(open, { ms: motion.ms.sheet, onSettled: (at) => at === 0 && setMounted(false) })`.
  It drops `expand` and `Animated`.
- `capture-dock.tsx` renders
  `<Sheet progress={progress} rideKeyboard scrim onDismiss={close}>`
  while mounted.
- `Sheet` (`components/ui/sheet.tsx`) takes `progress: Progress` and
  `rideKeyboard`. It drops `useSheetMotion` and its own `mounted`
  state. Delete `useSheetMotion` from `lib/motion/legacy.ts`.
- `BarState.lift` goes. `useBar()` returns `setHide(progress)`, and the
  dock calls it once at mount. `BottomBar` reads that `Progress` in an
  animated style and slides with a transform. It keeps its layout box,
  so no frame runs a layout pass. If a layout needs the box gone,
  collapse it once when the motion ends.
- With `rideKeyboard`, `Sheet` reads `height` and `progress` from
  `useReanimatedKeyboardAnimation` in `react-native-keyboard-controller`
  1.22.7 (`src/hooks/index.ts`, line 77). Both are shared values that
  the UI thread updates each frame. The dock moves with `translateY`,
  not `bottom`.
- `KeyboardStickyView` in 1.22.7 already moves a view by `height` plus
  an offset from that hook (`src/components/KeyboardStickyView/index.tsx`,
  lines 55 to 61). Use it, or copy its pattern.
- While the keyboard moves, the sheet's travel follows the keyboard's
  `progress`. The 220 ms `useProgress` drives it only when no keyboard
  moves, for example with a hardware keyboard or in the browser.
- Do not move the sheet into a native overlay window. There
  keyboard-controller does not track the focused input
  ([#1707](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1707)).
  A React Native `Modal` works, because 1.22.7 attaches to it
  (`ModalAttachedWatcher`).
- On the web the keyboard-controller bindings are a stub, so `height`
  and `progress` stay 0. Playwright sees only the `useProgress` path.
  The keyboard path is an emulator and phone check, and a Maestro flow
  in 0064.
- The send keeps ADR 0021's order. Blur and close happen in the tap's
  frame, and the write runs behind both.
- A close on focus loss unmounts the sheet at once (ADR 0040, amendment
  of 2026-11-07). The shared value still runs to 0 with no view, so the
  bar ends shown. Check that the bar is whole when the user returns.
- Update the sheet and dock component tests, which mock
  `useKeyboardAnimation`, to mock `useReanimatedKeyboardAnimation`.
- Remove this ticket's files from the 0058 lint allowlist.

### Tests first

Each bug gets a failing test before its fix, where the browser can show
it. The Playwright suite in `app/e2e` runs each scenario with the mouse
and with CDP touch. Reach the sheet by role and name: the "add task"
button, the "Add a task" placeholder and the "send task" button. Reduce
motion scenarios run in the `reduced-motion` project.

| Scenario | Proves |
|---|---|
| Open the sheet and sample each frame. The bar's travel and the sheet's travel match within one frame. | J4, one value |
| Type a task and send. The sheet starts to close on the frame of the tap, unmounts after its exit, and the new row lands once. | send order |
| Close with the scrim, then reopen during the exit. The sheet stays mounted and opens. | unmount |
| Open the sheet, switch to the Planner tab, and come back. The bar is whole, and the sheet is closed. | focus close |
| In the `reduced-motion` project, open and close land at their end states with no fade or scale frames. | L1 |

A jsdom component test checks that opening and closing the sheet
renders the screen behind it no times.

The browser has no soft keyboard, so the keyboard drift in J4 shows
only on the emulator and the phone.

### Review note from 0054

The review of 0054 (#77) found a second clock in the shared `Sheet`.
Line numbers cite commit `897373a`. When a caller passes an outside
`progress`, `components/ui/sheet.tsx:65-70` still runs its own 220 ms
clock through `useSheetMotion`. That clock does nothing useful. The
change above removes it. An outside-progress `Sheet` also keeps its
modal scrim in the overlay host while it is mounted, so the screen
stays hidden from assistive tech. Check that the scrim leaves the host
when the sheet closes.

## Acceptance

- [ ] Each scenario above has a failing test before its fix, and all
      pass after, with the mouse and with touch.
- [ ] The sheet, the scrim, the dock and the bar move on one
      `useProgress`, and use no React Native `Animated`.
      `useSheetMotion` and `BarState.lift` are gone. Lint passes with
      this ticket's files out of the allowlist.
- [ ] The scrim leaves the overlay host when the sheet closes.
- [ ] Emulator, with the `verify-monkey-tasks` Android path and its
      soft keyboard: in the recorded frames of the open and of a send,
      the gap between the sheet and the keyboard's top edge stays within
      2 px.
- [ ] Phone: on send, the keyboard and the sheet leave together, the
      bar returns, and no frame shows the keyboard up with the sheet
      gone.
- [ ] Phone: the result holds with gesture navigation and with three
      button navigation.
- [ ] Phone, reduce motion on: the sheet appears and leaves without a
      fade or a scale, and it still sits on the keyboard.

## Outcome
(filled in before moving to done/)
