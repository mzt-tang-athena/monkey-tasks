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
  Do Not Disturb. It resists a swipe while it rings and re-rings at 1, 5 and
  15 minutes. The alarm stream is the one a clock alarm uses. Do Not Disturb
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
  routine lists. It puts the answer behind a second note, and a single task
  no longer reads on its own.
- **A low, medium, high priority field.** A rank for ordering work. It says
  nothing about the alert, and the operator rejected it.
- **Notification sound only, no channels.** Simpler code. It cannot keep the
  phone's ringer silent for a need, or mute the cue without muting the need.
