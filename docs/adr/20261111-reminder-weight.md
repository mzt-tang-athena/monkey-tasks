# 20261111. A reminder has a weight, and the task owns it

- **Status:** accepted
- **Date:** 2026-11-11

## Context

The operator wants two kinds of reminder. A need should ring and be hard to
miss. A cue should be quiet and easy to clear.

Today the app treats every reminder the same. `app/src/lib/notifications.ts`
creates one Android notification channel called `reminders`, at the phone's
highest importance, with an alarm clock delivery. A channel is a group of
alert settings that the phone shows in its own settings screen. The result is
loud for everything, including a cue that was only meant to nudge.

Ticket 0094 settles that a timed `due` rings by default, with `reminders` for
extra alerts. It also leaves the weight of an alert to this decision. Ticket
0094 rejects a low, medium, high priority field, and the operator hates that
shape of field.

## Decision

We add one optional frontmatter property, `alert weight`, with two values,
`harsh` and `quiet`. It lives on the task, and it changes only the delivery
of the alert.

- Absent means `harsh`, because an alert you set is a promise. A missing or
  misspelled value must never make an alert silent.
- The editor writes `alert weight: quiet` for a cue and removes the line for a
  need, so only cues carry the property.
- A harsh alert uses its own channel on the alarm audio stream and bypasses
  Do Not Disturb. A swipe cannot clear it while it rings, and it re-rings at
  1, 5 and 15 minutes. The alarm stream is the one a clock alarm uses. Do Not Disturb
  is the phone setting that silences alerts on purpose.
- A quiet alert uses a second channel with no sound and no vibration, repeats
  never, and respects Do Not Disturb.
- Every alert a task produces uses the task's weight: its timed `due` and each
  entry in `reminders`. Two alerts at the same minute ring once.
- A recurring task copies the property to its next occurrence.

We rejected a weight on each reminder. One note could then mix a ring and a
quiet cue, and the frontmatter stops being readable at a glance. We rejected a
default on the list. It hides the answer in another note and makes one task
harder to reason about alone.

## Consequences

An alert is now predictable from the note that owns it. The operator can read
one line in Obsidian to know whether a task will ring.

The costs we accept:

- One task has one intent. A note that holds both a need and a cue has to be
  two tasks.
- A harsh alert rings with the ringer on silent. That is the point, and also
  the one setting that can surprise a bystander.
- The Do Not Disturb bypass needs one grant in system settings. The alert
  still rings, quieter, when the operator refuses.
- Android freezes a channel's settings at creation. The build adds
  `reminders-harsh` and `reminders-quiet` as new ids and deletes the old
  `reminders` channel. A channel id can never serve a second purpose later.
- The weight is invisible in the task list. The operator chose delivery only,
  so a need does not look different in a row. Both kinds share one order and
  one look.
- iOS is out of scope. It has no channel, and a need there needs its own
  decision.
- Ticking a task must cancel its remaining harsh repeats. That now makes the
  alert state depend on the tick path as well as the schedule.

Evidence for the channel calls sits in the ticket. The device check is still
to run. It covers the silent ringer, the Do Not Disturb grant and refusal,
and the three repeats. It also covers the cancel on tick and a quiet alert on
a loud phone.

## Alternatives

- **Weight on each reminder.** More control, and a note could hold a need and
  a cue. It loses on readability and on one intent per task.
- **Default weight on the list, with a per-task override.** Less typing for
  routine lists. It puts the answer behind a second note, and you can no longer read a
  single task on its own.
- **A low, medium, high priority field.** A rank for ordering work. It says
  nothing about the alert, and the operator rejected it.
- **Notification sound only, no channels.** Simpler code. It cannot keep the
  phone's ringer silent for a need, or mute the cue without muting the need.

## Amendment 2026-11-16: a bad value rings harsh and warns

The first draft said an unknown `alert weight` raises the note repair error.
That clashed with how the app reads notes.
A note with any schema error loses all its data.
Its row hides under Needs repair, and it schedules no alarm.
A typo such as `alert weight: loud` would then silence the task.
The decision forbids exactly that.

The operator chose a softer path.
An unknown value reads as `harsh`.
The note stays valid, keeps its row, and rings harsh.
The contract also returns a warning for that value.
Needs repair lists the warning, and the row stays in its list.

A warning is new.
It means "a valid note, with one value read by a fallback".
An error still means "the note fails, and the app hides it".

Alternative: read the unknown value as `harsh` with no message.
That was simpler.
The operator would learn of the typo only when a cue rang loud.

## Amendment 2026-11-26: a normal notification by default, an alarm by choice

The operator tried 1.3.0 on their phone. The reminders felt wacky, and
the harsh one made no real sound. They asked for the simplest system
first. This amendment replaces the Decision above. The contract half is
contracts ADR `20261126-alert-weight-opts-in-to-an-alarm`.

What the 1.3.0 harsh channel did, measured on the emulator:

- The channel had a sound. It held the phone's default notification
  tone, tagged as an alarm sound. A ring played it once, on the alarm
  stream, even with the ringer silent and Do Not Disturb on priority.
- That tone is one short ding. The phone picks it. A phone with a
  quiet or empty default tone gives no real alarm sound. We could not
  reach the operator's phone, so we infer this cause.
- `bypassDnd` was false on the channel. Android only keeps that flag
  when the app already holds Do Not Disturb access as it creates the
  channel. The app created it on first launch, before any grant.

The new rules:

- A task rings one normal notification at its time. It uses the phone's
  default sound and vibration. It shows Done, Later and Tomorrow. It
  follows Do Not Disturb, and a swipe clears it.
- A task with `alert weight: harsh` is an alarm. It sounds a tone the
  app bundles (`alarm.wav`, four seconds) on the alarm stream. It uses
  alarm clock delivery, and asks the phone to break Do Not Disturb.
- Nothing repeats. We removed the unswipeable ring and the 1, 5 and
  15 minute re-rings. The alarm needs neither to sound.
- Absent, `quiet` and any unreadable value mean a normal reminder.
  Existing lines stay as they are, with no vault edit.
- The editor has one Alarm switch. It writes `harsh`, or removes the
  line.
- The channels are `reminder-normal` and one alarm channel. The app
  deletes `reminders`, `reminders-harsh` and `reminders-quiet` on start.
  Android restores a deleted channel's sound when its id comes back, so
  an id never serves a second sound.
- Android keeps a channel's Do Not Disturb bypass only when the app
  holds that access as it makes the channel. A later grant never adds
  the bypass. The alarm has two channel ids,
  `reminder-alarm` and `reminder-alarm-dnd`. The app uses the one that
  matches the access, and deletes the other.
- A small local native module, `modules/alarm-access`, reads the access
  and opens the system screen that grants it. Settings shows whether the
  operator granted it. The app asks again on each foreground.

Alternatives we rejected:

- **Keep the phone's default tone for the alarm.** It needs no asset.
  It leaves the alarm only as loud as the phone's notification tone.
- **A looping, unswipeable alarm.** It sounds longest. Expo cannot set
  the insistent flag, and the operator asked for the simple path.

Costs we accept:

- The alarm tone adds a native asset, so this build needs a new APK.
- A failed-press notice now rings the normal sound. Before, it stayed
  silent.
- A Do Not Disturb grant lets the alarm past the filter. It does not
  unmute the alarm stream, so total silence still mutes the tone.
  Priority mode and alarms-only already let an alarm through.
- The grant adds a second alarm channel id. An operator who grants later
  sees the alarm channel replaced, not updated.
  The app re-arms each pending alarm into the live channel. A ring armed
  before the grant then never fires into the deleted one.
