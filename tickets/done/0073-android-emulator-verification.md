---
id: 0073
title: Verify on an Android emulator
created: 2026-11-07
priority: high
assignee: claude-code
pr:
depends: [0069]
---

## Spec

Phase 4 of epic 0047 moves every gesture and animation to the UI
thread, on Reanimated 4 and gesture handler 3. The web preview runs
worklets on the JS thread, so it cannot prove that work. Today only
the owner's phone can.

This machine now has the Android SDK, an x86_64 system image for API
35, and a usable KVM. Add an Android path to the project verification
skill, `.claude/skills/verify-monkey-tasks/`, so an agent can prove
native behavior itself:

- Launch boots one named AVD on its own port, creates it when it is
  missing, installs a given APK, seeds the sample vault, grants the
  folder through the system picker, and waits for the first task row.
- Doctor checks the instance in one read-only pass.
- Drive taps by accessibility label or text from `uiautomator dump`,
  and keeps screenshots, short recordings, the screen tree, the app
  log and the note files.
- Cleanup stops only the emulator it started. The evidence stays.

The APK comes from the `android` workflow on the epic branch. Prove
the path end to end once from a cold emulator on a real release APK.

## Acceptance

- [ ] `android-launch.sh <apk>` boots a cold AVD, installs the APK, seeds and grants the vault, and stops when the first task row shows.
- [ ] `android-doctor.sh` exits 0 on that instance and nonzero after cleanup.
- [ ] A drive helper taps by label and saves evidence under `app/build/verify/evidence/android-<stamp>/`.
- [ ] One native-only check from the feature map runs on the emulator, and its note change shows on the device.
- [ ] `android-cleanup.sh` stops only the emulator it started, and the evidence stays.
- [ ] `SKILL.md` lists what the emulator proves and what still needs the phone.

## Outcome
(filled in before moving to done/)
