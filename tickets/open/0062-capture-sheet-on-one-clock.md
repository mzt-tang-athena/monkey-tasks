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

Epic 0047, phase 4. ADR 0036 and its amendment to ADR 0021 decide
this. ADR 0021 says the sheet and the keyboard share one clock. They
do not. This ticket puts the sheet, the dock and the bar on Reanimated
shared values and rides the keyboard on the UI thread. The work lands
in the phase 3 homes: the shell's bar, `hooks/use-capture-sheet.ts`
and `components/capture-dock.tsx` in `src/features/capture` (0057),
and the `Sheet` primitive in `src/components/ui` (0054). Ticket 0057
keeps today's motion inside `use-capture-sheet`, and 0054 keeps it
inside `Sheet`, for this ticket to swap.

### What breaks today

Line numbers point at today's files.

| Bug | Today | What the user sees |
|---|---|---|
| J4 | `components/BottomBar.tsx:112-123` runs the open and close as a 220 ms timing on the JS driver. It animates `maxHeight`, `bottom` and `opacity` (`BottomBar.tsx:99-106,189-197,209-214`) and the sheet's opacity, translate and scale (`features/capture/components/CaptureSheet.tsx:104-124`). The keyboard height comes from `useKeyboardAnimation` (`CaptureSheet.tsx:87,153-161`), a native value on its own curve. The send also inserts a row on the JS thread in the same frames. | The sheet stutters, or drifts against the keyboard, on open and on send. |
| L1 | `BottomBar.tsx:112-123` and `CaptureSheet.tsx:104-124` ignore reduce motion. | The sheet fades and scales with reduce motion on. |

### The change

- `useCaptureSheet` owns one shared value, `open`, from 0 to 1. The
  sheet, the scrim and the bar read it through animated styles. Open
  and close run `withTiming` for 220 ms with `ReduceMotion.System`.
- The dock rides the keyboard through `useReanimatedKeyboardAnimation`
  from `react-native-keyboard-controller` 1.22.7
  (`app/node_modules/react-native-keyboard-controller/src/hooks/index.ts`,
  line 77). It returns `height` and `progress` as shared values that
  the UI thread updates each frame. The dock moves with `translateY`,
  not `bottom`.
- `KeyboardStickyView` in keyboard-controller 1.22.7 already moves a
  view by `height` plus an offset from that hook
  (`src/components/KeyboardStickyView/index.tsx`, lines 55 to 61). Use
  it for the dock, or copy its pattern.
- Do not move the sheet into a native overlay window. There
  keyboard-controller does not track the focused input
  ([#1707](https://github.com/kirillzyusko/react-native-keyboard-controller/issues/1707)).
  A React Native `Modal` works, because 1.22.7 attaches to it
  (`ModalAttachedWatcher`).
- On the web the keyboard-controller bindings are a stub, so `height`
  and `progress` stay 0. Playwright therefore sees only the 220 ms
  timing path. The keyboard path is a phone check, and a Maestro flow
  in 0064.
- While the keyboard moves, the sheet's travel follows the keyboard's
  `progress`. The 220 ms timing drives it only when no keyboard
  moves, for example with a hardware keyboard or in the browser.
- The bar slides out with a transform and keeps its layout box, so no
  frame runs a layout pass. If a phase 3 layout needs the box gone,
  collapse it once when the motion ends.
- The completion callback unmounts the sheet through `scheduleOnRN`.
  A reopen during the exit cancels the unmount, as today
  (`BottomBar.tsx:124-131`).
- The send keeps ADR 0021's order: blur and close in the tap's frame,
  then the write behind both.
- Remove this ticket's files from the 0058 lint allowlist.

### Tests first

Each bug gets a failing test before its fix, where the browser can
show it. The Playwright suite in `app/e2e` (0049) runs each scenario
with the mouse and with CDP touch. Reach the sheet by role and name:
the "add task" button, the "Add a task" placeholder and the "send
task" button.

| Scenario | Proves |
|---|---|
| Open the sheet and sample each frame. The bar's progress and the sheet's progress match within one frame. | J4, one value |
| Type a task and send. The sheet starts to close on the frame of the tap, unmounts after its exit, and the new row lands once. | send order |
| Close with the scrim, then reopen during the exit. The sheet stays mounted and opens. | unmount |
| With reduce motion emulated, open and close land at their end states with no fade or scale frames. | L1 |

A jsdom component test checks that opening and closing the sheet
renders the screen behind it no times.

The browser has no soft keyboard, so the keyboard drift in J4 shows
only on the phone.

## Acceptance

- [ ] Each scenario above has a failing test before its fix, and all
      pass after, with the mouse and with touch.
- [ ] The sheet, the scrim, the dock and the bar use no React Native
      `Animated`. Lint passes with this ticket's files out of the
      allowlist.
- [ ] Phone, reduce motion off: in a screen recording of the open and
      of a send, the gap between the sheet and the keyboard's top edge
      stays within 2 px on every frame.
- [ ] Phone: on send, the keyboard and the sheet leave together, the
      bar returns, and no frame shows the keyboard up with the sheet
      gone.
- [ ] Phone: the result holds with gesture navigation and with three
      button navigation.
- [ ] Phone, reduce motion on: the sheet appears and leaves without a
      fade or a scale, and it still sits on the keyboard.

## Outcome
(filled in before moving to done/)
