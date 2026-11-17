---
id: 0009
title: "MVP foundation: feature folders, vault layer, routing"
created: 2026-10-20
priority: high
assignee: opencode
pr:
depends: [0002, 0006]
---

## Spec

Turn the spike app into the real structure the rest of the MVP builds
on. No new features; restructure and connect.

- Bulletproof React feature folders under `src/`. `features/vault`
  owns the SAF grant, the folder scan, and note parse/write through
  `@monkey-tasks/schemas`. `features/tasks` queries and mutates task
  notes. `features/capture` takes the working capture code.
  `features/reminders` takes the alarm scheduling. The shared folders
  are `components/` and `lib/`.
- Expo Router for navigation (the app AGENTS.md requires it). Two
  bottom tabs follow the 2026-10-20 architecture: Lists and Planner.
  Screens are functional stubs with real data flowing. The child
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
`app/src/app/(tabs)/`. The vault layer is `features/vault` over
`expo-file-system/legacy` SAF. Task reads and writes go through
`@monkey-tasks/schemas`. Capture is the docked bottom bar on both
tabs. The round 33 to 35 sessions checked device behaviour
(folder grant affordance, add-task writes, status bar insets).

Ticket 0019 records two gaps found while consolidating on 2026-10-22.
The browser preview served mock tasks on a device with no vault.
Nothing ever called the reminders module. Ticket 0019 fixes both.
