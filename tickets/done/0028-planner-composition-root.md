---
id: 0028
title: PlannerScreen becomes a composition root
created: 2026-10-23
priority: normal
assignee: omp
pr: 28
depends: [0024]
---

## Spec

`PlannerScreen` is 632 lines: route state, store reads, drag state, swipe
guards, month model, two states and the JSX. The component split landed
in ticket 0024; the container did not.

Move the machinery into hooks and leave a composition root.

- `hooks/usePlannerGestures.ts`: the drag and swipe machinery, one
  cohesive unit because the drop suppression is shared by both.
- `hooks/usePlannerMonth.ts`: the month grid model and the picked day.
- `components/PlannerStates.tsx`: loading and error panes.
- `PlannerScreen.tsx`: data reads, source and form state, JSX.

No behaviour change. The drag, drop, swipe and grabber paths were just
verified on a phone, so hook order, ref writes and effect order stay as
they are.

## Acceptance

- [ ] The container is under 330 lines and reads as a composition root.
- [ ] Each hook is under 260 lines.
- [ ] Every drag, drop, swipe and grabber behaviour is unchanged.
- [ ] One component render test covers a visible planner behaviour.

## Outcome

`PlannerScreen` is 312 lines: route, store reads, source and form
state, JSX. `usePlannerGestures` holds the drag and swipe machinery,
`usePlannerMonth` the month model, `PlannerStates` the two panes.

The move is mechanical. Hook counts reconcile exactly against the old
file: 8 state, 9 refs, 3 callbacks, 6 effects, 4 memos, in the same
order.

Verified: `tsc` clean, 130 tests across 18 files, eslint 0 errors. The
new `TaskListSection` render test covers both names, the empty label,
and each row's toggle wiring.
