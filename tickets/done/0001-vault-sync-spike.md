---
id: 0001
title: Vault sync spike
created: 2026-10-17
priority: high
assignee: opencode
pr: 1
depends: []
---

## Spec

A bare Expo app installed on the phone by sideload. It gains folder access
to `Documents/obsidian-vault`, reads one task note, edits one property,
and writes the file back. This is the risk-first test of ADR 0002.

## Acceptance

- [x] the app reads a note and shows its frontmatter
- [x] the edit appears in Obsidian on desktop after LiveSync syncs
- [x] a scheduled notification fires with the app closed
- [x] a phone reboot does not drop a scheduled notification
      (passes with the app backgrounded; fails after swipe-away,
      see Outcome)

## Outcome

Spike succeeded on device (Xiaomi-family ROM) on 2026-10-19, PR 1.

- SAF folder grant works; the grant persists between launches.
- Reading a deed, parsing its frontmatter, editing `status`, and
  writing the file back all work. The edit reached the desktop vault
  after phone Obsidian ran LiveSync.
- Exact-alarm local notifications fire with the app closed.
- Reboot survival holds when the app runs in the background. After a
  swipe-away, the ROM treats the app as force-stopped. `BOOT_COMPLETED`
  never arrives, and stored alarms disappear until the app opens
  again. Mitigation for the real app: rescan and re-schedule on every
  open. A setup screen should guide users to Autostart and no battery
  restrictions.
- A check confirmed that the APK manifest contains the boot receiver
  and permissions. It follows that the failure is ROM-level rather
  than a build defect.
- A diagnostics screen (scheduled list + exact-alarm state) stays in
  the spike code and informs the real app's reminders feature.
