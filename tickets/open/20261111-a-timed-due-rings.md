---
title: A timed due rings
created: 2026-11-11
priority: normal
assignee:
pr:
depends: []
---

## Spec

Ticket 0094 decided that a `due` with a time rings, and that
`reminders` holds extra alerts.

Today `due` may carry a time, but it does not ring. The alarm list is
built from `data.reminders` only, in
`app/src/stores/tasks/reminder-sync.ts`, so a task with
`due: 2026-11-11T18:00` and no reminder is silent. The recurrence spawn
already treats a timed due as an alarm by copying it into `reminders`,
which shows the intent.

A timed due joins the alarm list. The order is the due time, then any
reminder. A reminder that repeats the due minute rings once, not twice.
A date-only due never rings. A completed task rings nothing.

The rule lives in one place, so the sync, the cancel on tick and the
per-task cancel on delete all agree. A denied permission still leaves
the notes untouched, and the sync stays best effort.

The weight of a reminder is a later ticket,
`20261111-reminder-weight`. Do not add it here.

The alarm content names the task and says it is due.

## Acceptance

- [ ] A task with a timed due and no reminder schedules one alarm at
      that time.
- [ ] A task with a date-only due schedules none.
- [ ] A reminder equal to the due minute schedules one alarm.
- [ ] A tick cancels the due alarm; an edit reschedules it.
- [ ] A denied permission changes no note and throws nothing.
- [ ] A device run proves the alarm rings and survives a reboot, or the
      box stays unchecked with the reason.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0`, `npx vitest run` and the e2e pass.

## Outcome

(filled in before moving to done/)
