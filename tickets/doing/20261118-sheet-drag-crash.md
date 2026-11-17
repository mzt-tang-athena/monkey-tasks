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

- [ ] A component test runs `timing` from its worklet code, outside the
      module scope, with no `easing`. It fails on main and passes here.
- [ ] No worklet in `app/src` reads a module value in a default
      parameter.
- [ ] The local gate passes: tsc, eslint, vitest and the full web suite.
- [ ] On the emulator, a release APK closes the task sheet with a drag
      and keeps running.

## Outcome

(filled in before moving to done/)
