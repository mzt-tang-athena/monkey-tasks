---
title: The planner's segmented controls get shorter
created: 2026-11-26
priority: normal
assignee: claude-lane-segmented
pr:
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

- [ ] Both controls draw shorter on the phone.
- [ ] Each segment still passes the 44pt target check.
- [ ] Emulator frames before and after.

## Outcome

(filled in before moving to done/)
