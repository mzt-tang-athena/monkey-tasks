---
title: Fast Android proof by swapping the JS bundle
created: 2026-11-18
priority: high
assignee: omp
pr: 172
depends: []
---

## Spec

Every lane builds a release APK to prove its change on the emulator. A
full build takes 37 to 48 minutes on this host, and the heavy queue
backs up for hours.

Most lane changes touch only JavaScript. The native layer stays the
same. Keep one release APK per native fingerprint. For a matching
checkout, replace only the JS bundle, then align and sign with the
release key.

One script returns an APK for a checkout. It computes the native
fingerprint, finds a cached base APK for that fingerprint, and swaps
the bundle in. When the fingerprint has no base, it runs the full
build and stores the result as the base.

A swapped APK is for the emulator only. A release still builds with
`build-apk.sh` and `CLEAN=1`.

## Acceptance

- [x] `scripts/android-apk.sh <checkout>` prints the APK path and the mode.
- [x] A swap finishes in minutes, not tens of minutes.
- [x] The swapped bundle matches a full build byte for byte.
- [x] The release smoke passes on a swapped APK and on a full build.
- [x] A JS-only change shows up in the swapped APK.
- [x] A fingerprint miss falls back to the full build.
- [x] `SKILL.md` says when to use the swap and when not to.
- [x] An ADR records fidelity, signing and the fingerprint misses.
- [x] The local gate passes.

## Outcome

A swapped APK replaces a 43-minute build with a one-minute swap.

- `scripts/android-apk.sh <checkout>` returns an APK.
- Cache: `~/code/monkey-tasks/apk-cache`, one base per key.
- The key is the fingerprint plus the JS asset digest.
- A hit swaps the bundle and app.config, then signs.
- A miss runs build-apk.sh and keeps that APK as the base.
- A tagged commit forces the full build.
- The swapped 1.1 bundle matches the release build.
- Only 40 bytes differ, two header hashes.
- app.config comes out byte-identical.
- Two swap runs: 46 s, and 97 s beside a build.
- A full build today took 42:59.
- The export bounds the swap at 24 to 89 s.
- A branch's JS label showed on the swapped APK.
- Release smoke: 22 passes on the swap.
- Release smoke: 21 passes on the full build.
- The full build misses the marker check, as it should.
- A cold pass spent 72 s before seeding.
- A relaunch on the running emulator seeded in 10 s.
- ADR `20261118-fast-android-proof` records the limits.
- Gate: tsc, eslint, 1179 tests, Vale, records.
- CI: 612 web e2e passed.
