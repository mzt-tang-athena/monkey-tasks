---
title: Reminder device check on the phone
created: 2026-11-11
priority: high
assignee:
pr:
depends: ["20261126-reminders-kiss"]
---

## Spec

The emulator proves the posts, the channels and the audio path. Only the
phone proves what the operator hears. This ticket was the 1.3.0 alert
check. Ticket `20261126-reminders-kiss` rewrote the design, so the old
repeat, escalation and unswipeable cases no longer apply. The emulator
evidence for the new design sits in that ticket's Outcome.

Cases on the phone, with the new build installed over 1.3.0:

1. A normal reminder sounds once with the phone's default sound.
2. A swipe clears it, and it never comes back.
3. Done, Later and Tomorrow work from the notification.
4. An alarm task plays the alarm tone, with the ringer on silent.
5. An alarm breaks Do Not Disturb in priority mode.
6. An alarm breaks total silence once Settings grants Do Not Disturb
   access before the channel exists. Note what happens when the grant
   comes after.
7. The phone's notification settings list `Reminders` and `Alarms`, and
   no `Harsh reminders`, `Quiet reminders` or old `reminders` channel.
8. The alarm tone is loud enough at the phone's usual alarm volume.

## Acceptance

- [ ] All eight cases pass on the phone, or Outcome records what the
      phone did instead.

## Outcome

(filled in before moving to done/)
