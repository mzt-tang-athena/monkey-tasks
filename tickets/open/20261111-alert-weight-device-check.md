---
title: Alert weight device check
created: 2026-11-11
priority: high
assignee:
pr:
depends: ["20261111-alert-weight-alerts", "20261111-alert-weight-editor"]
---

## Spec

Prove the alert behaviour on a phone. This is the check the parent ticket
promises, and the only place the platform can disagree with the spec.

Use the Android emulator path from ticket 0073, and then the operator's
phone. Both matter because an emulator may fake the alarm stream and Do Not
Disturb. Build a release APK and drive the app the way the
`verify-monkey-tasks` skill describes. Keep evidence under
`app/build/verify/evidence/android-YYYYMMDD-HHMMSS/`: screenshots, a
`dumpsys notification` capture per case, and the task notes used.

Cases:

1. A harsh task rings with the ringer on silent, and the status bar shows the
   alarm icon.
2. A harsh alert breaks Do Not Disturb once the operator grants notification policy
   access.
3. A harsh alert still rings, below Do Not Disturb, when the operator refuses that
   access.
4. A swipe cannot clear a harsh alert while it rings.
5. The repeats arrive at +1, +5 and +15 minutes, and none arrives at +20.
6. Ticking the task or opening it from the alert cancels the remaining
   repeats.
7. A quiet alert is silent with the phone volume up, sends no vibration,
   swipes away, and never repeats.
8. A note with no `alert weight` rings harsh.
9. A note with `alert weight: quiet`, edited in Obsidian to `loud`, rings
   harsh, keeps its row, and Needs repair shows the warning.
10. A timed due and a reminder at the same minute ring once.
11. The phone's notification settings show the two channels and no stale
    `reminders` channel.

If a case fails, do not paper over it. Write what the phone did in the
outcome. Fix the alert ticket or amend the parent decision before this moves
to done.

## Acceptance

- [ ] All eleven cases pass on the emulator and on the phone, or Outcome
      records each failure and what happened instead.
- [x] Screenshots and notification dumps sit in one evidence folder.
- [ ] Tick the parent ticket's device check list from this evidence.
- [x] The outcome names the APK build and the Android version.

## Outcome

Emulator pass done on 2026-11-17. The phone pass is still to run, so this
ticket stays open.

Build: local release APK from `d238c2a`, installed on the
`monkey-tasks-verify` AVD (API 35, x86_64, Pixel 7, Android 15). Evidence:
`app/build/verify/evidence/android-20261116-113135/alerts/`. The notes used
are in `app/build/device-check/`.

Proven on the emulator:

- Both channels exist as chosen. `reminders-harsh` has importance 5,
  `USAGE_ALARM`, `bypassDnd=true`, sound on and vibration on.
  `reminders-quiet` has importance 3, no sound, no vibration and no DND
  bypass. The app deletes the old `reminders` channel.
- A harsh ring posts on `reminders-harsh` with `flags=ONGOING_EVENT`, and the
  status bar shows the alarm icon.
- The four rings sit at 0, 1, 5 and 15 minutes in `dumpsys alarm`. The +1, +5
  and +15 all posted. At +20 nothing new posted. That held for the ladder
  task at 00:56 and the DND task at 01:06.
- A due and a reminder in one minute made one ring at 00:38. That group then
  escalated on its own.
- A note with no `alert weight` rang harsh (three tasks).
- `alert weight: loud` kept its row, rang harsh, and Needs repair showed
  `alert weight "loud" is not harsh or quiet, so it rings harsh`.
- Ticking the task cleared its tray entry, and no later ring for it appeared.
- A quiet cue posted once on `reminders-quiet`, silent, with no vibration and
  no follow-up. Ticking its task cleared it.
- With Do Not Disturb on and policy access granted, the 00:46 harsh ring
  posted. With access revoked and Do Not Disturb still on, the 00:51 +5 ring
  posted on the same channel.

Not proven on the emulator:

- Sound. The emulator cannot show that a harsh alert is audible with the
  ringer on silent. Nor can it show a quiet alert is inaudible at full
  volume.
- The swipe feel. One swipe left the `Tick me` ring in place. One ladder
  entry left the list during the run. Its +5 and +15 still rang, so a
  dismissed entry did not silence the need. Injected swipes on the shade were
  not reliable enough to settle the gesture.
- The audible part of Do Not Disturb. We proved the post and the channel
  flags. The sound is a phone check.

Phone checklist:

- Harsh with the ringer on silent: it rings, and the alarm icon shows.
- DND granted: it rings through. DND refused: it rings below DND.
- Swipe a ringing harsh alert. It should stay. If it leaves, the +5 still
  rings.
- Listen for +1, +5 and +15, then silence.
- Tick the task, or open it from the alert: the repeats stop.
- Quiet at full volume: no sound, no vibration, one ring, swipes away.
- A note with no key rings harsh.
- A due and a reminder in one minute ring once.
