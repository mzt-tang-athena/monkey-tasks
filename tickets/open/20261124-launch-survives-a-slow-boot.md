---
title: The emulator launch survives a slow boot
created: 2026-11-24
priority: normal
assignee:
pr:
depends: []
---

## Spec

The smoke lane saw `android-launch.sh` stop twice on 2026-11-24 under
load:

- It stopped at `adb root` on a fresh boot, before the device was ready
  for it.
- It stopped behind a System UI "isn't responding" dialog that it does
  not dismiss.

Each stop cost a full rerun of a heavy job.

- Wait for the device to accept `adb root`, with a bound, before the
  call.
- Find a System UI ANR dialog on screen and choose Wait, then go on.
- Print a line for each, so a log shows when it happened.

## Acceptance

- [ ] A run under load passes the `adb root` step every time.
- [ ] A planted ANR dialog gets dismissed, and the launch goes on.
- [ ] Neither wait raises an existing timeout.

## Outcome

(filled in before moving to done/)
