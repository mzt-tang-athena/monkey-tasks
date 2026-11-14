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
promises, and it is the only place the platform can disagree with the spec.

Use the Android emulator path from ticket 0073, and then the operator's
phone, because the alarm stream and Do Not Disturb are the two things an
emulator may fake. Build a release APK and drive the app the way the
`verify-monkey-tasks` skill describes. Keep evidence under
`app/build/verify/evidence/android-YYYYMMDD-HHMMSS/`: screenshots, a
`dumpsys notification` capture per case, and the task notes used.

Cases:

1. A harsh task rings with the ringer on silent, and the status bar shows the
   alarm icon.
2. A harsh alert breaks Do Not Disturb after notification policy access is
   granted.
3. A harsh alert still rings, below Do Not Disturb, when access is refused.
4. A harsh alert cannot be swiped away while it rings.
5. The repeats arrive at +1, +5 and +15 minutes, and none arrives at +20.
6. Ticking the task or opening it from the alert cancels the remaining
   repeats.
7. A quiet alert is silent with the phone volume up, sends no vibration,
   swipes away, and never repeats.
8. A note with no `alert weight` rings harsh.
9. A note with `alert weight: quiet` that is edited in Obsidian to `loud`
   rings harsh and shows the repair error.
10. A timed due and a reminder at the same minute ring once.
11. The phone's notification settings show the two channels and no stale
    `reminders` channel.

If a case fails, do not paper over it. Write what the phone did in the
outcome and fix the alert ticket, or amend the parent decision, before this
moves to done.

## Acceptance

- [ ] All eleven cases pass on the emulator and on the phone, or each failure
      is written down with what happened instead.
- [ ] Screenshots and notification dumps sit in one evidence folder.
- [ ] The parent ticket's device check list is ticked from this evidence.
- [ ] The outcome names the APK build and the Android version.

## Outcome

(filled in before moving to done/)
