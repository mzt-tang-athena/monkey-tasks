---
id: 0084
title: A settings screen
created: 2026-11-11
priority: normal
assignee: opencode
pr: 119
depends: [0083]
---

## Spec

Add a Settings screen. A thin route at `app/src/app/settings.tsx` that
re-exports `features/settings`. Sections:

1. Appearance: a theme picker with a swatch and a name for each
   palette (ticket 0083). The active one is a checked radio in a radio
   group.
2. Lists and planner: sort mode (My order or Due) and task form (rows
   or chips). These exist in `app/src/lib/settings.ts` today.
3. Diagnostics: the crash log from ticket 0081 and the dev route.
4. About: version, build channel, vault folder, repo link.

Entry point: one tap from Lists and one from Planner. Until the command
pane (ticket 0085) lands, put Settings in the list overflow menu above
the 0065 list actions. Keep the route on the back stack so the Android
back gesture returns to the same screen and tab.

Every read and write goes through `lib/settings.ts`. The screen does
not read or write the vault. Every control is 44pt by layout, named,
and reports its state.

## Acceptance

- [x] Settings opens from Lists and Planner in one tap. Back returns to
      the same screen and tab.
- [x] Theme, sort mode and task form change and persist across a
      reload.
- [x] All controls are 44pt, named and report the right state. axe
      reports no serious or critical issue.
- [x] The screen touches no vault file.
- [x] e2e covers open, change, back, reload and persistence.

## Outcome

Fixed on 2026-11-11 on `feat/0084-settings`. Pull request #119,
merge `508e700`.

The route is `app/src/app/settings.tsx`, a thin re-export. The screen
owns the theme picker, the two screen settings, the diagnostics link
and the About facts. Lists opens it from the overflow menu, and Planner
from a 44pt gear in day, week and month.

The theme picker is a `radiogroup`; each palette is a `radio` with a
checked state and a 44pt row. A pick repaints through `ThemeProvider`
without a remount. The sort mode and task form use `settings-store.ts`,
a live copy of the settings record. A mounted Lists or Planner screen
updates on return, which a focus refresh cannot guarantee.

The stack header is hidden and the screen draws its own 44pt Back,
because the native header's back link is 30pt and does not follow the
palette. The About facts use `expo-constants`. The vault folder is the
saved root string, and the screen never calls the adapter.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint src scripts e2e --max-warnings 0` | clean |
| `npx vitest run` | 85 files, 749 tests passed |
| Local e2e, port 8594 | 402 passed, 26 skipped, 0 failed |
| CI `e2e-web` | 402 passed, 26 skipped |
| Verifier | PASS. Store race closed, entry points, route and ADR checked |
| axe, four palettes | no serious or critical issue |
| Visual | 412 by 915 and 360 by 640, budget and midnight |

### Evidence limits

The Android back gesture, the SAF folder value and the theme switch on
a phone are unproven. The web e2e covers the route, the provider and
the memory adapter.

A revoked vault grant still displays its old uri, because the screen
shows the saved root string. That is display-only.

The 360pt planner header has the gear and the mode switch with about
268pt left for three segments. It rests on the visual check; no
automated 360pt test covers that row.

The build channel reads `__DEV__`, because EAS does not put its channel
on the manifest. A preview build reads `production`.
