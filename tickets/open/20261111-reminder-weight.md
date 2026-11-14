---
title: Reminder weight
created: 2026-11-11
priority: high
assignee:
pr:
depends: ["0094-review-the-task-note-schema"]
---

## Spec

The operator wants two kinds of reminders.

- Harsh. A need to do. It should ring and be hard to miss.
- Dismissible. The task is a cue for a time and is not urgent. It should
  be quiet and easy to clear.

Today `reminders` is a list of datetimes and `due` is a date or a
datetime. A timed due does not ring. Ticket 0094 settles that a timed
due rings by default. This ticket settles the weight.

The operator hates vague priorities such as low, medium and high. This
weight may be what they wanted from a priority field. Do not
add a P1 to P4 field.

Questions to settle:

1. Is the weight on the task, on each reminder, or a default on the
   list? In most cases a task has one intent, so a task property is the
   simplest. Say why if not.
2. Values. `harsh` and `soft`? `need` and `cue`? Pick words the
   operator will use out loud.
3. Notification behavior. A harsh alarm needs a channel, a sound and
   no easy dismissal. A soft one is silent, or a banner that clears on
   its own. Check both on the phone.
4. Escalation. Does a harsh reminder repeat when ignored? How many
   times, and when does it stop?
5. Vault shape. A frontmatter property is visible in Obsidian. What is
   the key and the values?
6. Recurrence. A spawned occurrence carries the same weight. Confirm.
7. Due and reminders. A harsh task with a due time and a reminder may
   ring twice. State the rule.

Deliver a spec in this ticket, and an ADR if a real alternative remains.
Add a device check of the notification behavior. Do not build the field
before the operator decides.

## Decisions

The operator answered on 2026-11-11.

### Where the weight lives

On the task. One note, one intent, one weight. The editor writes it, the
parser reads it, and every alert the task produces uses it.

We rejected two shapes. A weight on each reminder lets one note mix a ring
and a quiet cue. The vault field also stops being readable at a glance. A
default on the list hides the answer in another note. It also makes one task
harder to reason about on its own.

### What weight means

Delivery only. It decides what the alert does when it fires. It does not
order tasks, move sections, or tint rows. The weight is not a priority field.
It replaces one. Ticket 0094 keeps P1 to P4 out.

### Values and vault shape

- Key: `alert weight`. The space matches `recurrence previous`, the key the
  schema already uses, and reads well in Obsidian's properties panel.
- Values: `harsh` and `quiet`.
- Absent means `harsh`. A timed alert is a promise, so a missing field never
  goes quiet. This matches 0094: a timed `due` rings by default.
- The editor writes `alert weight: quiet` for a cue and removes the line for
  a need. Only cues carry the property, so the vault stays clean.
- An unknown value falls back to `harsh` and raises the note repair error.
  A typo must never make an alert silent.
- A plain string, not a wikilink. The values are words rather than notes.

### What each weight does

| | `harsh` | `quiet` |
|---|---|---|
| Channel | `reminders-harsh`, importance MAX | `reminders-quiet`, importance DEFAULT |
| Sound | default sound on the alarm stream | none, channel `sound: null` |
| Vibration | yes | no |
| Do Not Disturb | bypasses it | respects it |
| Repeat | re-rings at +1, +5, +15 minutes | never |
| Dismissal | sticky while ringing, a swipe cannot clear it | swipes away, or one tap clears it |
| Foreground | banner and sound | banner, no sound |

The alarm stream is the one a clock alarm uses. A harsh alert rings with the
ringer on silent, which is what makes a need hard to miss.

A harsh alert stops repeating at +15 minutes, or at the first
acknowledgement. Ticking the task, opening the task from the alert, or
tapping the alert cancels its remaining repeats. A need is not a siren.

A quiet alert clears on tap, on swipe, or when the app clears it for a task
you ticked. It has no timer of its own, because a timer needs a background
task for no gain.

The foreground handler in `lib/notifications.ts` plays sound for every
notification today. It must decide by weight: harsh plays, quiet does not.

### Due and reminders

A timed `due` and each `reminders` entry fire at the task's weight, so they
share one loudness. No task holds a "harsh due, quiet reminder".

A due time and a reminder at the same minute ring once, not twice. Capture
writes a reminder from the due time, so this case is common today.

A task with no time produces no alert, so its weight does nothing. An
all-day due does not ring and is not affected.

A completed task rings nothing, as it does today.

### Channels get new ids

Android freezes a channel's behavior at creation; only the name and
description can change later. The existing `reminders` channel already
carries MAX importance and no sound choice, so we do not reuse it. The build
creates `reminders-harsh` and `reminders-quiet` once, and deletes the old
`reminders` channel so no stale entry sits in the phone's settings.

### Facts checked on 2026-11-11

- `expo-notifications` 58.1.5 exposes `bypassDnd`, `sound`,
  `audioAttributes.usage = AndroidAudioUsage.ALARM`, `importance`,
  `enableVibrate` and `vibrationPattern` on a channel.
- `delivery: "alarmClock"` needs the exact alarm permission and falls back
  to `bestEffort` without it. `app/app.json` already declares
  `SCHEDULE_EXACT_ALARM`, and `requestExactAlarmPermissionsAsync` can ask.
- A harsh repeat is a separate scheduled notification. The build keeps the
  id of each follow-up per task so one acknowledgement cancels the rest.
  Today `reminder-sync.ts` keeps ids per task but schedules one alert per
  reminder. It needs the follow-up ids in that map.
- Android asks for the Do Not Disturb bypass once, in system settings. The
  app can only request it, and the alert must still work when refused.

### Recurrence

A spawned occurrence copies `alert weight` exactly, like `due` and
`reminders`. That means `SpawnInput`, `spawnContent` and
`isUntouchedSpawn` in `app/src/stores/tasks/spawn.ts`. A weekly harsh task
rings harsh every week until the property changes.

### Scope

Android. The app is Android first, and the vault goes through SAF. iOS has
no channel and no exact alarm, and a need there needs an `interruptionLevel`
decision. That is a later ticket if the app ships on iOS.

### Child tickets

1. Schema and parser. Add `"alert weight"?: "harsh" | "quiet"` to the task
   frontmatter in the contracts submodule. Absent means harsh, unknown falls
   back to harsh with a repair error. Fixtures for harsh, quiet, absent and
   unknown. Depends on 0094.
2. Alerts. Two channels, weight passed into `scheduleAt`, a foreground
   handler by weight, the three follow-ups and their cancel. Quiet cleared
   on tick, the DND request, the old channel deleted. Depends on
   `20261111-a-timed-due-rings`, already done, and reuses its `alarmTimes`.
3. Editor. A two-state control in the task editor, writing and removing the
   property through the existing edit path. No row marker, because weight is
   delivery only.
4. Device check. The checklist below, with screenshot and notification dump
   evidence, on the emulator path from ticket 0073 and on the phone.

### Device check

Not run yet. It needs a build. On the phone, check:

- A harsh alert rings with the ringer on silent, and shows the alarm icon.
- A harsh alert breaks Do Not Disturb after the permission grant, and
  still rings when refused.
- A swipe cannot clear a harsh alert while it rings.
- The +1, +5 and +15 repeats arrive, and stop after +15.
- Ticking the task cancels the remaining repeats, and so does opening it.
- A quiet alert is silent with the phone loud, sends no vibration, swipes
  away, and never repeats.
- A note with no `alert weight` rings harsh.
- A due time plus a reminder at the same minute rings once.

## Acceptance

- [x] The operator picks the field, its values and where it lives.
- [ ] The ticket records the notification behavior for each weight, and
      the phone check confirms it.
- [ ] The ticket records the vault shape, which reads well in Obsidian.
- [ ] Split the build into child tickets, or drop the idea.

## Outcome

(filled in before moving to done/)
