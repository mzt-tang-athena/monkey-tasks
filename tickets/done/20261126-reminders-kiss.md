---
title: Reminders, kept simple
created: 2026-11-26
priority: high
assignee: opencode
pr: 0
depends: []
---

## Spec

The operator tried 1.3.0 on their phone on 2026-11-26. The reminder
system felt wacky, and the harsh reminder made no real sound. They asked
to revise the reminders and reduce them to a KISS first.

The default becomes one normal notification:

- It rings once at its time, with the phone's default notification sound
  and vibration.
- It carries Done, Later and Tomorrow (#231).
- A swipe clears it. It never repeats. It follows Do Not Disturb.

A task can opt in to a real alarm, with `alert weight: harsh`:

- It plays an alarm sound and breaks Do Not Disturb.
- Find why the 1.3.0 harsh channel was silent first, and fix it.
- The alarm path has no repeats and no unswipeable ring, unless an alarm
  cannot sound without them.

The contract changes first. In contracts, an absent `alert weight` reads
`quiet`, and `harsh` opts in (contracts PR 24).

Channels:

- New channel ids, because Android freezes a channel's sound.
- The app deletes the 1.3.0 channels on start.
- The phone's settings show only the live channels.

The app ignores existing `alert weight` lines in notes. No vault edit.

The editor offers one simple control for the alarm. This ticket also
settles `20261111-alert-weight-device-check`.

## Acceptance

- [x] The contract reads an absent `alert weight` as `quiet`.
- [x] A normal reminder sounds once with the default sound, swipes away
      and does not repeat, on the emulator.
- [x] An alarm plays on the alarm stream and breaks Do Not Disturb, on
      the emulator.
- [x] Only the live channels exist after an upgrade over 1.3.0.
- [x] The editor has one control for the alarm.
- [x] The weight ADR has a dated amendment, and the old device check
      ticket is rewritten for the new design.

## Outcome

Shipped in one PR. What the emulator proved, Android 15, release APK:

- A normal reminder posted once on `reminder-normal`. It alerted with
  the phone's default sound: `notification_alert` beep=1, and a
  MediaPlayer on USAGE_NOTIFICATION. One swipe cleared it.
- No repeat: the app leaves one ring per alarm minute. The OS held no
  alarm for the note after it rang.
- An alarm posted at its exact minute under Do Not Disturb priority.
  It alerted (beep=1) and played a MediaPlayer on USAGE_ALARM.
- The upgrade over 1.3.0 left `Alarms` and `Reminders` in Settings.
  The app deleted the old `reminders-harsh` and `reminders-quiet`.
- With Do Not Disturb access, the app makes `reminder-alarm-dnd` with
  `mBypassDnd=true`. Without it, an alarm stays below total silence.

What the emulator could not show: total silence mutes the alarm stream
itself, so no alarm sounds there. The phone check covers the rest.

The contract half is contracts PR 24. Its submodule pointer here moves
to the merge commit once the operator merges it.

Evidence: `~/code/monkey-tasks/worktrees/evidence-reminders-kiss/`.
Gate: full pass on `26f7555`.
