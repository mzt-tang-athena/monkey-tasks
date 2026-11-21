---
title: Prove the day split range on Android
created: 2026-11-21
priority: low
assignee:
pr:
depends: []
---

## Spec

PR #146 widened the day split's travel to 44pt from each edge. Its
ticket claimed Android evidence that was never produced. The web E2E
proves the clamp. Nobody has checked the device on record.

- Install the current release APK on the emulator.
- Drag `~resize timeline` to both limits, by touch.
- Save a frame at each limit, and read the pane heights from a dump.

## Acceptance

- [ ] A frame at the top limit shows a 44pt top pane.
- [ ] A frame at the bottom limit shows a 44pt bottom pane.
- [ ] The frames sit in the evidence folder the PR names.

## Outcome

(filled in before moving to done/)
