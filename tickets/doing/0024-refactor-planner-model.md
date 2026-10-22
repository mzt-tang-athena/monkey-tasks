---
id: 0024
title: Pull the planner model out of the route
created: 2026-10-22
priority: normal
assignee: omp
pr:
depends: []
---

## Spec

The planner route was 3,505 lines: screen, UI components, styles and
domain helpers in one file. A review against the Bulletproof React
practices found the route owning business logic that nothing tested.

Move the pure scheduling helpers into `features/planner/model.ts`:
source cycling and labels, pill filtering, done checks, open-first sort,
day and week indexes, the day task sets, and the time rules
(`withTime`, `withKeptTime`, `hasTime`, `timeOf`, `hourOf`, `minuteOf`,
`isoOf`, `startOfWeek`, `startOfMonth`, `isoWeek`).

Also in this pass:

- the planner error state says "Pull to retry" on a screen with no pull
  to refresh; it gets a real retry button wired to `store.refresh()`
- an error boundary wraps the route stack, so a render error shows a
  retry panel instead of a blank app
- `lib` may not import `features` or `app`, enforced in eslint
- `CaptureTarget` drops its unused `uri`, and the Lists screen loses a
  nested-render IIFE

## Acceptance

- [ ] The helpers live in `features/planner/model.ts` and are imported by the route.
- [ ] `model.test.ts` covers the time and ordering rules.
- [ ] The planner error state retries.
- [ ] A render error shows the boundary panel.
- [ ] `lib` imports no feature or route, and eslint says so.

## Outcome

(filled in before moving to done/)
