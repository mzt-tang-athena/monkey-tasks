---
id: 0028
title: PlannerScreen becomes a composition root
created: 2026-10-23
priority: normal
assignee: omp
pr:
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

(filled in before moving to done/)
