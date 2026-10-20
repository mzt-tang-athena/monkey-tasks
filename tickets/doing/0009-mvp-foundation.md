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

- [ ] the app builds and runs with two bottom tabs (Lists, Planner)
- [ ] task queries go through the schemas package, not hand parsing
- [ ] capture works from both tabs through the floating button
- [ ] folder grant, and status writes still work on device
