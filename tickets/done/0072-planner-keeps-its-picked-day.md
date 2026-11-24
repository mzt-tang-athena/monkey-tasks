---
id: 0072
title: Keep the planner's picked day across a tab round trip
created: 2026-11-07
priority: normal
assignee: opencode
pr: 213
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
mounted. The picked day lives only in the `day` URL param.
`src/features/planner/hooks/use-planner-route.ts` reads it with
`useLocalSearchParams`. It sets it with `router.setParams`. When the
param is missing, it falls back to today. The bottom bar's Planner tab
(`src/components/bottom-bar.tsx`) calls `router.navigate("/planner")`
with no params, so each return drops `?day=`.

## Acceptance

- [ ] An e2e test picks a day, goes to Lists and back, and finds the
      same day. It fails before the fix.
- [ ] The phone keeps the picked day across the same trip.

## Outcome

Every in-app route into the tab dropped `?day=`, and the route read the
missing param as today. The picked day now lives in a module store
beside the route, `features/planner/lib/picked-day.ts`. A route that
names no day opens on the last day the planner named. A link still wins
on the day it names.

`parsePlannerDay` reports "no day" again, so it invents no date.
The hook picks the param, the remembered day, then today.
A run with no pick still moves on at midnight.

Proof, on PR 213:

- `planner-day.spec.ts` picks Wed 28, then rounds through Lists,
  Journal and Inbox Notes. It also enters again through the command
  pane's Planner command. It failed 4 of 4 at the base code. It passed
  4 of 4 at the fix, in both motion projects.
- The emulator kept the picked day through the same trip. The APK was
  a release build from this branch.
- ADR `20261124-planner-picked-day` records the choice against putting
  `?day=` on the two navigates.

Not kept: the mode resets as before, and a reload starts at today.

