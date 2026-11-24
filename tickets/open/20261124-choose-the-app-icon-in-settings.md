---
title: Choose the launcher icon in Settings
created: 2026-11-24
priority: normal
assignee:
pr:
depends: [20261124-monkey-app-icon]
---

## Spec

The operator wants to pick the launcher icon from Settings. The set
starts with the monkey, which is the default, and the matcha tick from
ADR `20261118-app-icon`. More designs may follow, so a new icon should
be one asset set plus one entry in a list.

Android cannot change a launcher icon at runtime the way iOS can. The
work starts with research, before any build:

- Search for what exists for Expo SDK 58 on Android. That covers
  activity-alias config plugins and alternate-icon modules.
- Record what each needs, in the ADR template's plain style.
- Record the trade-offs. Some launchers drop the home screen shortcut
  when the activity changes, and the app may restart on a switch.

The Settings row names the choice and can undo it. The chosen icon
survives a restart, and a fresh install shows the monkey.

The icon sources stay in `app/scripts/app-icon/`, one drawing per icon,
because that pipeline already produces every size from one source.

## Acceptance

- [ ] A note or ADR records the Android options and their trade-offs.
- [ ] Settings offers the monkey and the tick, and marks the current one.
- [ ] A switch survives a restart, and the home screen redraws.
- [ ] A fresh install still shows the monkey.
- [ ] The emulator shows a switch and the icon after it.

## Outcome
(filled in before moving to done/)
