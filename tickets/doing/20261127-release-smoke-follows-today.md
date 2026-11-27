---
title: The release smoke taps Main before Completed
created: 2026-11-27
priority: high
assignee: omp
pr:
depends: []
---

## Spec

The 1.4.0 release stopped at its smoke: three checks failed.

- "Completed did not open": Today leads the tabs, and a tick leaves
  Today, so the Completed group lives on Main.
- "delete removed nothing": it followed from the first failure.
- "sheet did not open": "Call Mum" has no date, so only Main shows it.

The app was right; the smoke never tapped Main. It taps Main after
the tick now. Re-run against the 1.4.0 APK: every check passed.

## Acceptance

- [x] The 1.4.0 APK passes the smoke with the fix.
- [ ] A later release smoke starts on Today and reaches Completed.

## Outcome

Fixed during the 1.4.0 freeze, because the release cannot ship
without a green smoke. Test-only: no app code changed.
