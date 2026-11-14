---
id: 0086
title: Reorder from the grip only, with screen reader steps
created: 2026-11-11
priority: normal
assignee: omp
pr: 115
depends: []
---

## Spec

The user asked for two things that are one change.

1. Lists: remove the row overflow menu with Move up, Move down, Move to
   top and Move to bottom
   (`app/src/features/lists/components/task-card-row.tsx:117`). Stop
   the row's hold from starting a drag. Only the six-dot grip starts a
   drag. That frees the horizontal swipe between lists.
2. Accessibility: ticket 0063 added that menu as the non-drag path for
   TalkBack. Do not remove the path. Move it onto the grip. The grip
   reports `adjustable` on native (web maps it to `slider`). It has
   increment and decrement actions that move the row one position in
   My order. They write through the same `ReorderEvent` a drop writes.
   Reuse the pattern from `app/src/components/motion/split.tsx`. The
   grip's name says what it does, and its value says the position.

Keep the grip a 44pt target. Keep its drag on the UI thread with the
existing press and pan rules. A row swipe must still page, and a
vertical scroll must still scroll.

Trade-off: the row body no longer starts a drag, so a user must find
the grip. It shows in My order, and its name and value explain it
to TalkBack. Record this change as a dated amendment to the 0063
outcome or to ADR 0040.

## Acceptance

- [x] No row overflow menu in My order. No other screen shows
      Move up, Move down, Move to top or Move to bottom.
- [x] A hold on a row body does not pick it up. A hold on the grip
      does. A horizontal swipe on a row pages.
- [x] The grip reports `adjustable` with increment and decrement.
      Each step writes the order like a drop, proven by reading the
      note back.
- [x] The grip is 44 by 44 by layout, and axe reports no serious or
      critical issue.
- [x] The e2e suite covers the swipe, the grip drag and the steps. The
      TalkBack check appears as unproven if the emulator cannot
      drive the actions.

## Outcome

Fixed on 2026-11-11 on `feat/0086-grip-only`. Pull request #115,
merge `e541659`.

The row menu and its four moves no longer exist. The row body no longer
carries a drag gesture. The grip is the only source. A hold on the
body does nothing, a press opens the editor, and a horizontal swipe
pages. The pager keeps `pan-y`, so vertical scroll still works.

The grip reports `adjustable` on native and `slider` on web. Its name
is `reorder <task>`, its value is its one-based place in the group, and
it declares increment and decrement. Each step moves one place through
`stepSpan` and the same data-index `ReorderEvent` a drop writes. The
arrows run the same step on web, through the shared `useArrowKeys`.
The grip is 44 by 44 by layout.

The 0063 non-drag path moved from the menu to the grip, and 0063
carries the dated amendment.

| Check | Result |
|---|---|
| Row-body hold, base | fails with a drag ghost, page does not turn |
| Grip slider, base | fails, no element has the role |
| Arrow down | writes `order: 2` and `order: 1`, read back |
| `npx tsc --noEmit` | clean |
| `npx eslint src scripts e2e --max-warnings 0` | clean |
| `npx vitest run` | 81 files, 732 tests passed |
| `E2E_PORT=8590 npm run e2e` | 372 passed, 26 skipped, 0 failed, no retries |
| a11y spec, 4 runs | 256 passed |
| Verifier | PASS. Built base `95e3037`, saw the four target e2e tests fail, then pass on head |

### Evidence limits

`e2e-web` on CI never reaches the tests. `npx playwright install
--with-deps chromium` stalls on apt because the runner cannot resolve
`archive.ubuntu.com` and `azure.archive.ubuntu.com`, and the 10-minute
job limit cancels it. The local e2e run above is the evidence, and the
tests need a rerun when the runner's mirror access works.

TalkBack on a device is unproven. The grip's role, its value and its
two actions need the phone. The web tests cover the slider role and
the arrow keys only.

A step from the grip while another row's drag is in flight can reorder
the data under the stale snapshot. It belongs to the same class as the tick
that lands mid-drag, and `20261111-reorder-during-a-tick-hold` now
covers it.
