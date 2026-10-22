---
id: 0009
title: MVP foundation: feature folders, vault layer, routing
created: 2026-10-20
priority: high
assignee: opencode
pr:
depends: [0002, 0006]
---

## Spec

Turn the spike app into the real structure the rest of the MVP builds
on. No new features; restructure and connect.

- Bulletproof React feature folders under `src/`: `features/vault`
  (SAF grant, folder scan, note parse/write through
  `@monkey-tasks/schemas`), `features/tasks` (query and mutate task
  notes), `features/capture` (moves the working capture code),
  `features/reminders` (moves the alarm scheduling), shared
  `components/` and `lib/`.
- Expo Router for navigation (the app AGENTS.md requires it), with
  two bottom tabs per the 2026-10-20 architecture: Lists and Planner.
  Screens are functional stubs with real data flowing; the child
  tickets (0010, 0012) own their real UI.
- The persistent capture affordance (floating button, works on every
  screen) moves here as a working component.
- The app consumes the contracts package through the existing
  submodule and `file:` dependency.
- The spike diagnostics screen stays available behind a dev-only
  route; nothing user-facing regresses.

## Acceptance

- [x] the app builds and runs with two bottom tabs (Lists, Planner)
- [x] task queries go through the schemas package, not hand parsing
- [x] capture works from both tabs through the floating button
- [x] folder grant, and status writes still work on device

## Outcome

Shipped as PR 6 and extended on `design-final`. The two tabs are
`app/src/app/(tabs)/`, the vault layer is `features/vault` over
`expo-file-system/legacy` SAF, task reads and writes go through
`@monkey-tasks/schemas`, and capture is the docked bottom bar on both
tabs. Device behaviour was checked during the round 33 to 35 sessions
(folder grant affordance, add-task writes, status bar insets).

Two gaps found while consolidating on 2026-10-22 are recorded in
ticket 0019: the browser preview served mock tasks on a device with no
vault, and the reminders module was never called. Both are fixed
there.
