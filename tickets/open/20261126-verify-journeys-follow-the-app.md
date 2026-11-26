---
title: The verify journeys follow the app
created: 2026-11-26
priority: normal
assignee:
pr:
depends: [20261125-verify-launch-wants-a-shut-shade]
---

## Spec

Three journeys of the `verify-monkey-tasks` skill fail on main,
with or without an open shade:

- `android-list-swipe.sh`: "Nothing on this list yet." never shows.
- `android-references.sh`: the editor never opens; `sheet-handle`
  stays missing.
- `android-reminder-actions.sh`: "Probe Plain stayed in the tray".

The app changed under them: Today leads the tabs, capture changed,
and reminders got new channels. A lane that runs one of these
journeys inherits a failure it did not cause.

- Find the app change each journey missed, and update the journey.
- If a journey no longer tests anything real, retire it and say so
  in the PR.
- Prove each fixed journey green on the emulator, twice.

## Acceptance

- [ ] Each journey passes twice, or the PR retires it with a reason.
- [ ] A lane naming one of these journeys no longer inherits a
      failure from it.

## Outcome

(filled in before moving to done/)
