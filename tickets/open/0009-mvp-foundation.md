---
id: 0009
title: MVP foundation: feature folders, vault layer, routing
created: 2026-10-20
priority: high
assignee:
pr:
depends: [0002, 0006]
---

## Spec

Turn the spike app into the real structure the rest of the MVP builds
on. No new features; restructure and connect.

- Bulletproof React feature folders under `src/`: `features/vault`
  (SAF grant, folder scan, note parse/write through
  `@monkey-tasks/schemas`), `features/tasks` (query and mutate task
  notes), `features/capture` (moves the working capture code), shared
  `components/` and `lib/`.
- Expo Router for navigation (the app AGENTS.md requires it): tabs
  for focus, upcoming, calendar; the spike screens become routes.
- The app consumes the contracts package through the existing
  submodule and `file:` dependency.
- The spike diagnostics screen stays available behind a dev-only
  route; nothing user-facing regresses.

## Acceptance

- [ ] the app builds and runs with Expo Router tabs
- [ ] task queries go through the schemas package, not hand parsing
- [ ] capture, folder grant, and status writes still work on device
