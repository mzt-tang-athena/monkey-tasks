---
title: The planner's segmented controls get shorter
created: 2026-11-26
priority: normal
assignee: claude-lane-segmented
pr: 248
depends: []
---

## Spec

The operator's feedback on 2026-11-26, with a phone screenshot. The
Day, Week and Month control and the list and pill form toggle look
oversized. Reduce their height a little.

- Both use `SegmentedControl`. Check every other use of it, and keep
  them consistent.
- Keep a 44pt touch target. The hit area can stay larger than the
  drawn pill.
- Show the operator frames before and after.

## Acceptance

- [x] Both controls draw shorter on the phone.
- [x] Each segment still passes the 44pt target check.
- [x] Emulator frames before and after.

## Outcome

Every segment now draws a 36 high pill inside its 44 high press
target. The control draws 41dp tall on the phone, down from 49dp.
The target keeps its 44 by 44 size, so the hit area stays put.
The Settings and task editor controls share the component and shrink
the same way. Frames before and after sit in the PR.
