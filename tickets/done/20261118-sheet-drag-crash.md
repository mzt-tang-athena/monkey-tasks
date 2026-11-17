---
title: Stop the sheet drag from crashing the app on Android
created: 2026-11-18
priority: high
assignee: omp
pr:
depends: []
---

## Spec

The 1.0 release smoke crashed the release APK on the emulator. A drag
down on an open task sheet closed it, and the app died at once.

The log says `ReferenceError: Property 'motion' doesn't exist` in
`timing_progressTs2`, called from the sheet drag's release.

`timing` in `app/src/lib/motion/progress.ts` is a worklet. Its `easing`
parameter defaults to `motion.easeOut`. The worklets Babel plugin runs a
default parameter before the body unpacks the closure. On the UI thread,
`motion` is not there yet. Any UI-thread call that leaves out
`easing` crashes. The sheet drag's dismiss is one. The web preview runs
worklets on the JS thread, so the web suite never saw it.

Read the default curve inside the body, where the closure is in scope.
Add a test that runs the worklet's own code the way the UI runtime does.

## Acceptance

- [x] A component test runs `timing` from its worklet code, outside the
      module scope, with no `easing`. It fails on main and passes here.
- [x] No worklet in `app/src` reads a module value in a default
      parameter.
- [x] The local gate passes: tsc, eslint, vitest and the full web suite.
- [ ] On the emulator, a release APK closes the task sheet with a drag
      and keeps running. The 1.0 release ticket carries this check, on
      the APK built after this merge.

## Outcome

`timing` now defaults its curve in the body. The worklet reads
`motion` after it unpacks its closure, so the UI thread has it.

`progress.test.tsx` runs `timing` and `spring` from their own worklet
code at global scope. The `timing` case failed on main with
`ReferenceError: motion is not defined`, the same error as the crash.
It passes here.

A lint rule now rejects a default parameter on any worklet. It flagged
the old `timing` and nothing else in `src`.

Gate on `ca4f4bf`: tsc, eslint, and 1133 unit tests in 117 files. The
full web suite had 578 passed and 26 skipped in 15.1 minutes.
