---
id: 0084
title: A settings screen
created: 2026-11-11
priority: normal
assignee: opencode
pr:
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

- [ ] Settings opens from Lists and Planner in one tap. Back returns to
      the same screen and tab.
- [ ] Theme, sort mode and task form change and persist across a
      restart.
- [ ] All controls are 44pt, named and report the right state. axe
      reports no serious or critical issue.
- [ ] The screen touches no vault file.
- [ ] e2e covers open, change, back, reload and persistence.

## Outcome

(filled in before moving to done/)
