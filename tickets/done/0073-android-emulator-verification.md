---
id: 0073
title: Verify on an Android emulator
created: 2026-11-07
priority: high
assignee: claude-code
pr: 93
depends: [0069]
---

## Spec

Epic 0047 phase 4 moves every gesture and animation to the UI thread,
on Reanimated 4 and gesture handler 3. The web preview runs worklets on
the JS thread, so it cannot prove that work. Today only the owner's phone
can prove it.

This machine now has the Android SDK, an x86_64 system image for API
35, and a usable KVM. Add an Android path to the project verification
skill, `.claude/skills/verify-monkey-tasks/`, so an agent can prove
native behavior itself:

- Launch boots one named AVD on its own port, and creates it when
  missing. Launch installs a given APK and seeds the sample
  vault. It then grants the folder through the system picker, and waits
  for the first task row.
- Doctor checks the instance in one read-only pass.
- Drive taps by accessibility label or text from `uiautomator dump`.
  It keeps screenshots, short recordings, the screen tree, the app
  log and the note files.
- Cleanup stops only the emulator it started. The evidence stays.

The APK comes from the `android` workflow on the epic branch. Prove
the path end to end once from a cold emulator on a real release APK.

## Acceptance

- [x] `android-launch.sh <apk>` boots a cold AVD, installs the APK, seeds and grants the vault, and stops when the first task row shows.
- [x] `android-doctor.sh` exits 0 on that instance and nonzero after cleanup.
- [x] A drive helper taps by label and saves evidence under `app/build/verify/evidence/android-<stamp>/`.
- [x] One native-only check from the feature map runs on the emulator, and its note change shows on the device.
- [x] `android-cleanup.sh` stops only the emulator it started, and the evidence stays.
- [x] `SKILL.md` lists what the emulator proves and what still needs the phone.

## Outcome

The verification skill has an Android section and seven helpers under
`scripts/android-*`. One journey, `journeys/android-list-swipe.sh`,
covers the Lists recipe on the emulator.

Proof came from a cold emulator on the CI release APK of `4828d9c`.
Launch reached a task row in 372 s (boot 165 s, install 46 s, first app
start 112 s). Another agent's Playwright run was loading that host at
the time. Doctor exited 0. The journey turned the page with motion on
and off. The frame grids show the slide and the jump. The tick wrote `completed:`
to the note. Cleanup stopped only our pid, Doctor then exited 1, and
the evidence stayed in `app/build/verify/evidence/android-20261108-052424/`.

Choices made on the way:

- The vault reaches the device with `adb push` of the sample seed,
  dated for the device's today. The picker walk grants it once. The
  grant lives in the AVD's data, so later launches keep it, and
  `FRESH=1` grants again. A snapshot was not needed.
- Motion evidence comes from `screenrecord --output-format=frames`,
  turned into PNGs and a grid by `android-frames.mjs`. The host has no
  ffmpeg, and a `screencap` loop spoiled the swipe it watched.
- Launch hides ANR dialogs. System UI misses its deadlines on a busy
  host, and the dialog covered every screen.

The journey's last step fails today: an untick leaves the old tail in
the note. That is a real Android bug, filed as 0076. The journey keeps
the check, so it passes once 0076 lands.

Not yet run on an APK: `hold-drag`, `drag`, `type`, and the dev client
path. The capture sheet with the keyboard is the next recipe to add.
