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

Fixed on 2026-11-11 on `feat/0081-crash-log`. Pull request #121,
merge `d7f24cb`.

The app keeps one text file at
`Paths.document/monkey-tasks-crash.log`. Each caught error appends an
entry with the time, app version, build channel, platform, kind, fatal
flag, message, 30 stack lines and the breadcrumb ring. Writes are
synchronous on native, so the bytes land before the process can die.
A failed write is swallowed. The file is capped at 200 KB; when an
entry would pass the cap the file moves to
`monkey-tasks-crash.old.log` and the entry starts a new one. The
rotation decision is a pure function, tested without a device.

The global handler reports before it shows its alert. The render
boundary reports once per catch with its screen label. The breadcrumb
ring holds 20 actions in memory: tick, open, tab, drag start and drag
drop. A detail is a task title, a list name or a group and its index
range, collapsed and clipped to 80 characters. No note body enters it.

Settings > Diagnostics shows a Crash log card. It reads the count and
the size against the cap, previews the newest entry at 1400
characters, and offers Copy and Share of the whole file. Both are 44pt
and disabled when the log is empty.

The web preview keeps the same text in local storage, so the e2e can
read, copy, share and reload it. The test hooks exist only under the
test-hook flag, so a release APK and a normal web build have no
`__crash` global.

### The animation thread

`react-native-worklets` 0.13.0, which Reanimated 4.7.1 installs,
exposes no worklet error hook. `WorkletRuntime::invoke` catches a
`jsi::JSError` only inside `#ifndef NDEBUG`, and the reporting path is
inside the same guard. A release build compiles both out, so the
exception crosses C++ and the process dies before any JS handler runs.
That is the 0080 crash. The log captures JS-thread and render errors
only, and the card says so in one line. No broad worklet guard was
added; the 0080 fix stays the guard on that path.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint src scripts e2e --max-warnings 0` | clean |
| `npx vitest run` | 90 files, 781 tests passed |
| Local e2e, port 8596 | 406 passed, 26 skipped, 0 failed |
| CI `e2e-web` | 406 passed, 26 skipped |
| Verifier | PASS. Rotation, durability, breadcrumbs, handler, hooks and the worklet source checked |
| Vault | no write, proven by unit test and an e2e file-map comparison |

### Evidence limits

Copy and Share on Android are unproven. The new `expo-clipboard`
module needs a rebuilt dev client or APK, and no device was up. The
web preview proves the wiring and the payload.

The 0080 release crash is unproven too. The worklet source says it is
not captured; no release APK run shows what reaches the log.

The native append path itself runs on device only. Unit tests mock
`expo-file-system` and the e2e runs the local storage branch, so the
native append, rotation and size read have no automated run.

The card reads the log once at mount, so a crash that lands while
Settings is open shows on the next visit. Two small assertions are
missing: the exact-cap equality case, and the entry count after a
boundary retry. Both are behavior the code already holds.
