---
id: 0078
title: A planner row press is lost after a drop on the web
created: 2026-11-10
priority: high
assignee: omp
pr: 104
depends: [0058, 0061]
---

## Spec

On the web, a press on a planner row can do nothing when the row
re-renders under the finger. The user taps a row's circle after a drop,
and nothing ticks.

Evidence, 2026-11-10. Ticket 0061's test "a tap 100 ms after a drop
still ticks the row" failed once in the `e2e-web` job for PR 101. The
job passed when rerun on the same commit. The owner's report of the
failure says Playwright clicked a stable button, and the row never
ticked.

This is the class the 2026-11-10 amendment to ADR 0046 records.
Gesture handler's web `Pressable` drops a press when the view
re-renders under the finger, and when the view has not been measured
yet. The lists screen left that press for React Native's, because no
pan sits above a list row. The planner cannot: a drag pan must cancel
a row press, so the planner's rows use gesture handler's press. The
lists fix does not apply here.

The drag surface's own tests pass, and the row press is the remaining
gap. It costs the user a tap, and it shows as a flaky test.

## What to do

1. Reproduce first, on the same web build, with the load that shows
   the race. Six concurrent browsers, a drop, then a tap 100 ms later,
   120 presses. Record the lost count on the current head.
2. Trace the lost press to the first place it goes wrong. The two
   suspects the AMENDMENT names are a re-render under the finger and a
   view pressed before its first layout report.
3. Fix it where the surface owns the press, not at a call site. Keep
   the property the surface exists for: a pan that starts on a row
   still cancels the row press.
4. Add the reproduction as a test that fails before the fix and
   passes after. A load-based test is acceptable when its pass is
   deterministic at the fix and its fail is deterministic at the bug.
5. Record the mechanism and the fix as a dated amendment to ADR 0046.

## Acceptance

- [x] A reproduction loses presses on the current head, with the
      count and the run recorded. A tap in the same task as a captured
      row's mount did not tick; 1 of 80 immediate taps after a drop was
      lost under load.
- [x] After the fix, the same reproduction loses none in 120, run
      twice. None of 120 immediate taps and none of 240 taps at 100 ms
      were lost on the final code.
- [x] `planner-drag.spec.ts` "a tap 100 ms after a drop still ticks
      the row" passes 20 consecutive runs.
- [x] A pan that starts on a row still opens no editor, and a drop
      leaves no click behind. The held-tick cancel tests pass with the
      mouse and CDP touch, and the existing no-editor and no-toggle
      specs stay green.
- [x] ADR 0046 carries the dated amendment.
- [x] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0`, `npx vitest run` and the Playwright suite
      pass.

## Outcome

Every press on the web now takes the browser's click. A row that mounts
or re-renders under the finger still presses, and no layout report is
needed. A pan that starts on a target cancels it: a pointer that
travels past the hold's 8 px slop drops the press, and each pan surface
arms a one-shot click guard on activation.

Mechanism. Gesture handler's web `Pressable` fires from pointer up and
first checks the press against the view's layout report. Before that
report the box is 0 by 0, and a tap at the middle of a target with
`hitSlop` fails `isTouchWithinInset`. A tap in the same task as a
captured row's mount did not tick on head; a tap on a laid-out row did.
The press is also bound to the node that took the pointer down, so a
row that mounts or is replaced under the finger loses it.

Fix. `components/ui/pressable.tsx` exports one `Pressable`: React
Native's on the web, gesture handler's on native. It fires from the
browser's click, which goes to the element under the pointer at
release. A pointer that travels more than the hold's slop drops the
press, which restores the old cancel on pointer leave.
`components/motion/internal/press-cancel.ts` holds a per-surface
one-shot guard. `createDragSurface`, `createReorderSurface`, `Pager`
and `Split` arm it on pan activation. It stops the next click at
`window` capture, however late the browser sends it, and disarms on
that click or on the next pointer or key down. No timer window blocks
a later tap (V10).

Measurements. On head, the reproduction failed at the note assertion
(the tick never landed) and an immediate tap in the drop's frame lost
1 press of 80 under load. At the fix, none of 120 immediate taps and
none of 240 taps at 100 ms were lost. "A tap 100 ms after a drop still
ticks the row" passed 20 of 20 runs. The held-tick cancel tests passed
40 of 40 across the mouse, CDP touch and both projects.

Tests. `e2e/specs/press.spec.ts` has the first-layout reproduction and
the held-tick cancel checks.
`components/motion/internal/press-cancel.test.tsx` pins the one-shot
guard.

Removed test workarounds. The two-frame layout wait in
`e2e/locators.ts` is gone because the press no longer reads a layout.
The capture settle wait in `reorder.spec.ts` is gone because the press
no longer drops on the row's re-render. `vault.spec.ts` "three ticks of
a month-end task" now steps the page clock past each tick hold before
the next press; that test was red 7 times in 20 on head because the
click landed on a row that had moved.

Gates: `npx tsc --noEmit` clean, `npx eslint src scripts e2e
--max-warnings 0` clean, `npx vitest run` 80 files and 715 tests, and
`E2E_PORT=8583 npm run e2e` 293 passed, 25 skipped, no retries.

Native. No emulator ran. The native path still uses gesture handler's
`Pressable`. A device would prove a pan cancels it with no click tail,
and Enter and Space press on a hardware keyboard.

PR: https://github.com/mzt-tang-athena/monkey-tasks/pull/104
