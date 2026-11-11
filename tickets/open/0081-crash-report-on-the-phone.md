---
id: 0081
title: Keep a crash report on the phone
created: 2026-11-11
priority: normal
assignee:
pr:
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

## Acceptance

- [ ] A forced JS error writes one entry with time, version and stack.
      The Diagnostics section shows it.
- [ ] A forced render error writes one entry with its screen label.
- [ ] The log caps at 200 KB and rotates.
- [ ] Copy and Share work on Android. Nothing is uploaded.
- [ ] A run of the 0080 native crash records what is and is not
      captured.
- [ ] No vault writes.

## Outcome

(filled in before moving to done/)
