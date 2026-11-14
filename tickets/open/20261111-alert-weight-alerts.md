---
title: Alert weight in the alerts
created: 2026-11-11
priority: high
assignee:
pr:
depends: ["20261111-alert-weight-schema", "20261111-a-timed-due-rings"]
---

## Spec

Make an alert behave by its weight. The parent decision lives in
`20261111-reminder-weight.md`; read it first.

The timed due already rings. `20261111-a-timed-due-rings` is done, and
`alarmTimes` in `app/src/stores/tasks/reminder-sync.ts` builds the alarm list:
the timed due, then each future reminder, sorted and deduped by minute, with
the due winning a shared minute. This ticket takes that list and adds the
weight. It does not re-derive which times ring.

Today `app/src/lib/notifications.ts` has one channel called `reminders`, at
MAX importance, with `delivery: "alarmClock"`, and a foreground handler that
plays sound for every notification. The sync schedules one alert per entry in
`alarmTimes` and keeps the ids per task.

Build:

1. Two channels with new ids, `reminders-harsh` and `reminders-quiet`. Android
   freezes channel settings at creation, so the old `reminders` channel is
   deleted and never reused.
2. `reminders-harsh`: importance MAX, `sound: "default"`, `enableVibrate`
   true, and `audioAttributes` with `usage: AndroidAudioUsage.ALARM`. A harsh
   alert then rings with the ringer on silent, like a clock alarm.
3. `reminders-quiet`: importance DEFAULT, `sound: null`, `enableVibrate`
   false.
4. Do Not Disturb. The harsh channel sets `bypassDnd: true`. Android honors
   that only when the app holds notification policy access, which the user
   grants in system settings. Declare `ACCESS_NOTIFICATION_POLICY` in
   `app/app.json` and give the app a way to open that settings screen (for
   example `expo-intent-launcher` with the notification policy access
   action). Do not block the alert on the grant: without it a harsh alert is
   still loud, just not above Do Not Disturb.
5. A harsh alert is sticky while it rings, so a swipe does not clear it.
   Opening the task from the alert clears it.
6. Escalation. A harsh alert re-rings at +1, +5 and +15 minutes, then stops.
   Schedule the three follow-ups as separate notifications on the harsh
   channel and keep their ids per task. The first one uses `alarmClock`; the
   follow-ups use the same channel without `alarmClock`, so the phone shows
   one alarm icon and not four.
7. Cancel on acknowledgement. Ticking the task, opening it from the alert, or
   tapping the alert cancels the remaining follow-ups. Extend the id map in
   `reminder-sync.ts` so one task's follow-ups cancel together, and cover the
   tick path in `app/src/stores/tasks/mutations/use-toggle-task.ts`.
8. Quiet clears on tick too, so a cleared task leaves no tray entry.
9. The foreground handler decides by weight. It reads the notification's
   weight from `content.data` and returns `shouldPlaySound` only for harsh.
10. Keep the dedupe in `alarmTimes`. Do not re-derive times in the weight
    path, and keep its tests for a due and a reminder in one minute green.
11. A completed task schedules nothing, as today.

Do not add a sound file, a row marker, or a settings toggle. The sound is the
phone's default alarm sound.

## Acceptance

- [ ] The two channels are created once and the old `reminders` channel is
      deleted.
- [ ] A harsh alert rings on the alarm stream, bypasses Do Not Disturb when
      granted, and cannot be swiped away while ringing.
- [ ] A harsh alert re-rings at +1, +5 and +15 minutes and then stops.
- [ ] Ticking the task cancels its remaining follow-ups.
- [ ] A quiet alert is silent, does not vibrate, and repeats never.
- [ ] The foreground handler plays sound for harsh and not for quiet.
- [ ] A due time and a reminder at the same minute schedule one alert.
- [ ] Lint and typecheck pass, and the existing reminder tests still pass.

## Outcome

(filled in before moving to done/)
