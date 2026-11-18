---
title: Fast Android proof by swapping the JS bundle
created: 2026-11-18
priority: high
assignee: omp
pr:
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

- [ ] `scripts/android-apk.sh <checkout>` prints the APK path and the mode.
- [ ] A swap finishes in minutes, not tens of minutes.
- [ ] The swapped bundle matches a full build byte for byte.
- [ ] The release smoke passes on a swapped APK and on a full build.
- [ ] A JS-only change shows up in the swapped APK.
- [ ] A fingerprint miss falls back to the full build.
- [ ] `SKILL.md` says when to use the swap and when not to.
- [ ] An ADR records fidelity, signing and the fingerprint misses.
- [ ] The local gate passes.

## Outcome
