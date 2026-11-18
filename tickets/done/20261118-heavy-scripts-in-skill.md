---
title: Move the heavy job scripts into the verify skill
created: 2026-11-18
priority: high
assignee: omp
pr:
depends: []
---

## Spec

The full build, the web suite and the release smoke live in a
scratch folder outside the repo. `android-apk.sh` calls the build
there. A restart would wipe all three.

Proof builds compile native code for four CPU types. The emulator
needs one.

## Acceptance

- [x] `android-build.sh`, `web-suite.sh` and
      `android-release-smoke.sh` live in the verify skill.
- [x] Each takes the heavy lock itself.
- [x] `android-apk.sh` calls the skill's build by default.
- [x] A proof build compiles for x86_64 only.
- [x] A `CLEAN=1` release build compiles every CPU type.
- [x] The skill and the fast proof ADR describe both.

## Outcome

- The scripts moved, with logs under `$MONKEY_LOG_DIR`.
- The scratch copies now call the main checkout's scripts.
- The ADR has a dated amendment on the CPU type trade-off.
- The next lane build is the first live run of the new path.
