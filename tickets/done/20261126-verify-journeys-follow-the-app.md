---
title: The verify journeys follow the app
created: 2026-11-26
priority: normal
assignee: claude-lane-verify-journeys
pr: 257
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

- [x] Each journey passes twice, or the PR retires it with a reason.
- [x] A lane naming one of these journeys no longer inherits a
      failure from it.

## Outcome

No journey retired. Each one missed an app change.

- `android-list-swipe.sh`: the app opens on Today. The journey opens
  Main and swipes from the repair banner. It ticks `Call Mum`, since
  `Plan weekend hike` sits on Focus. It opens the folded Completed
  group before it reads the ticked row.
- `android-references.sh`: the task has no date and lives on Main.
  The journey taps Main first.
- `android-reminder-actions.sh`: it passed on this head, so the
  failure was a race. We inferred that and did not reproduce it.
  Done writes the note, then clears the tray. The journey read the
  tray at once, so it now waits. It also checks the normal channel,
  no alarm, and one reminder at the new due after Later or Tomorrow.

Each journey passed twice on the emulator.
