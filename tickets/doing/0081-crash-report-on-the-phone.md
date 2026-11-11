---
id: 0081
title: Keep a crash report on the phone
created: 2026-11-11
priority: normal
assignee: opencode
pr: 121
depends: [0084]
---

## Spec

A crash report the operator can read and send without a laptop.

- `app/src/lib/errors.ts` installs a JS global handler that shows an
  alert but keeps nothing. Persist the same report to
  `Paths.document/monkey-tasks-crash.log` with the time, app version,
  build channel, platform, message and the first 30 stack lines.
  Append, cap at 200 KB and rotate one old file.
- The error boundary reports its caught render error with its screen
  label.
- Keep a breadcrumb ring of the last 20 user actions in memory (tick,
  open, tab, drag start, drag drop). Write it with the crash report.
  No note body and no task text beyond the title.
- The Diagnostics section of Settings (ticket 0084) lists the log, with
  Copy and Share. Use `expo-sharing` if it is already installed.
  Otherwise ask before adding it.
- No network and no third party. ADR 0003 keeps the app offline first.
  Sentry is a separate decision with a privacy cost.

Native limit: a Reanimated worklet exception is a C++ exception and can
bypass the JS handler. That is what happened in ticket 0080.
Investigate what Reanimated 4.7 exposes for worklet errors. If nothing
reaches JS, record the limit here and rely on the 0080 fix plus a
worklet precondition that reports through `runOnJS` before it throws.
Do not claim a native crash is captured unless a run proves it.

Investigated on 2026-11-11 against `react-native-worklets` 0.13.0, the
runtime Reanimated 4.7.1 installs. The package exports no worklet error
hook. `WorkletRuntime::invoke` catches a `jsi::JSError` only inside
`#ifndef NDEBUG`, then bubbles it to the React Native runtime through
`ErrorUtils.reportFatalError`. A release build compiles the catch out,
so the exception crosses C++ and the process dies before any JS handler
runs. That is the 0080 crash. So the global handler captures JS-thread
and render errors only. The 0080 fix stays the guard on that path, and
this ticket adds no broad worklet guard.

## Acceptance

- [x] A forced JS error writes one entry with time, version and stack.
      The Diagnostics section shows it. Proven by
      `src/lib/errors.test.ts` and `e2e/specs/crash-log.spec.ts`.
- [x] A forced render error writes one entry with its screen label.
      Proven by `src/components/error-boundary.test.tsx`.
- [x] The log caps at 200 KB and rotates. Proven by
      `src/lib/crash-log.test.ts`.
- [ ] Copy and Share work on Android. Nothing is uploaded. Copy and
      Share are wired and pass on the web preview and in component
      tests. No Android run: no device was up, and the new
      `expo-clipboard` module needs a rebuilt APK.
- [ ] A run of the 0080 native crash records what is and is not
      captured. Not run on a device. The limit above comes from the
      worklet runtime source, and PR 113 holds the 0080 run.
- [x] No vault writes. Proven by `src/lib/crash-log.test.ts` and the
      vault comparison in `e2e/specs/crash-log.spec.ts`.

## Outcome

(filled in before moving to done/)
