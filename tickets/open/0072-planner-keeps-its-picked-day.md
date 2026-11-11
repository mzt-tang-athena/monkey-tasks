---
id: 0072
title: Keep the planner's picked day across a tab round trip
created: 2026-11-07
priority: normal
assignee:
pr:
depends: []
---

## Spec

The verifier of PR #80 found this on 2026-11-07, in the web preview at
412 by 915. It shows on `origin/epic/0047-rebuild` before PR #81 too,
so no open PR caused it.

Steps:

1. Open Planner. Pick a day other than today, for example Wednesday 28.
2. Tap Lists in the bottom bar.
3. Tap Planner.

The planner shows today, Monday 26, not the day the user picked. The
same happens with the capture sheet open or closed.

A user who plans a day, checks a list, and comes back loses their place.
The planner should keep its picked day for as long as the app runs.

The cause is in shared code, so the phone does the same. The tab stays
mounted. The picked day lives only in the `day` URL param:
`src/features/planner/hooks/use-planner-route.ts` reads it with
`useLocalSearchParams`, sets it with `router.setParams`, and falls back
to today when it is missing. The bottom bar's Planner tab
(`src/components/bottom-bar.tsx`) calls `router.navigate("/planner")`
with no params, so each return drops `?day=`.

## Acceptance

- [ ] An e2e test picks a day, goes to Lists and back, and finds the
      same day. It fails before the fix.
- [ ] The phone keeps the picked day across the same trip.

## Outcome

(filled in before moving to done/)
