---
id: 0019
title: Consolidate design-final and fix the device bugs it carried
created: 2026-10-22
priority: high
assignee: omp
pr: 11
depends: [0009, 0016]
---

## Spec

The design work lived on `design-final` while `main` held the older
foundation, so the app the user tested on a phone and the app on
`main` were different programs. The port from the browser preview to
the APK carried assumptions that only hold on web. Consolidate the
branches and fix what the port broke.

Known defects at the start of this ticket:

- `@monkey-tasks/schemas` needs zod v4, but the app installed zod v3
  (a transitive Expo dependency). Every screen that imported the
  schemas package crashed at module load on a clean install.
- `GestureHandlerRootView` was missing from the root layout, so
  `GestureDetector` never received touches on Android.
- The store wrote multiple frontmatter keys through `setProperty`,
  which re-derived each write from the same stale file text. A
  two-key patch kept only the last key.
- With no vault granted, a phone showed the browser preview's mock
  tasks, and ticking them did nothing.
- The Lists tab filtered with the mock helpers, so a task tagged with
  any other list appeared in neither tab.
- A single unreadable entry in `Tasks/` rejected the whole load.
- `isFile` guessed from a dot in the name, so a folder like
  `Tasks 2.0` was never found and `ensureSubfolder` made a duplicate.
- Frontmatter list continuation only recognised two spaces, so a
  tab-indented list had the next key spliced into it.
- `features/reminders/schedule.ts` had no caller: reminders were
  stored in the note and never scheduled.
- `rrule` was a dependency with no importer: completing a recurring
  task deleted it instead of rolling it forward.

## Acceptance

- [x] a clean clone builds and runs: `npm ci` at the root, `npm ci`
      in `app`, `npx expo export --platform android` succeeds
- [x] `npx tsc --noEmit` and `npx vitest run` pass in `app`
- [x] reminders are scheduled on device for tasks that carry one
- [x] ticking a recurring task moves its due date forward
- [x] no task is invisible: Main is the catch-all list tab
- [x] CI runs typecheck, both test suites, and an Android bundle

## Outcome

PR 11. `main` fast-forwarded to `design-final`, then the port defects
were fixed on top. The zod pin is the one that mattered most: a clean
`npm ci` in `app/` installed zod 3 through an Expo transitive, so
`@monkey-tasks/schemas` threw `z.object(...).loose is not a function`
at module load and every screen that imported it failed. The bundle
now carries zod 4 only.

Verified: `npx tsc --noEmit` clean, 47 app tests and 21 schema tests
pass, `npx expo export --platform android` produces a 5.5 MB bundle,
and `npm ci` succeeds at the root and in `app/`.

Left open on purpose: the capture parser still titles a bare date
phrase ("tomorrow") with the phrase itself, and a recurring task with
no usable due date completes instead of rolling. Both need a product
decision, not a mechanical fix.
