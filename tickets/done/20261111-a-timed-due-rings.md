---
title: A timed due rings
created: 2026-11-11
priority: normal
assignee: omp
pr: 125
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

- [x] A task with a timed due and no reminder schedules one alarm at
      that time.
- [x] A task with a date-only due schedules none.
- [x] A reminder equal to the due minute schedules one alarm.
- [x] A tick cancels the due alarm; an edit reschedules it.
- [x] A denied permission changes no note and throws nothing.
- [x] A device run proves the alarm rings and survives a reboot, or the
      box stays unchecked with the reason.
- [x] `npx tsc --noEmit`, `npx eslint src scripts e2e
      --max-warnings 0`, `npx vitest run` and the e2e pass.

## Outcome

One rule, `alarmTimes` in `app/src/stores/tasks/reminder-sync.ts`. It
returns the alarms an open task should ring: the timed due, then each
future reminder, sorted by time and deduplicated by minute. The due wins
a shared minute. A date-only due never enters the list. The full
rebuild, the tick move and the edit move all call it, so they agree.

The alarm title is the task name. The body is `Due` for a timed due and
`Task reminder` for a reminder.

Tests first. New cases in `reminder-sync.test.ts` failed on the old code
with 6 failures, then passed. They cover:

- one alarm at a timed due, with body `Due`
- no alarm for a date-only due
- one alarm when a reminder repeats the due minute
- two alarms in time order when the due and a later reminder both exist
- a reminder still ringing on a date-only due
- a completed task silent, and a tick cancelling the due alarm
- an edit that moves the due rescheduling it
- a denied permission scheduling nothing and leaving the note alone
- a past due scheduling nothing

`store-races.test.tsx` expected a single alarm for a kept successor. The
open parent now rings at its own timed due, so it lists both alarms.

Gates after the rebase onto `6fdf38a`:

- `npx tsc --noEmit`: pass
- `npx eslint src scripts e2e --max-warnings 0`: pass
- `npx vitest run`: 816 passed, 93 files
- `E2E_PORT=8602 npm run e2e`: 438 passed, 26 skipped

Device, release APK from `5357916` on the `monkey-tasks-verify` AVD:

- A note due at 11:53 local, app sent home at 11:46. `dumpsys alarm`
  showed one exact alarm for 11:53, `window=0`. The shade showed
  "Verify due alarm / Due" at 11:53.
- The two seeded timed dues scheduled exact alarms too. The seeded
  date-only dues scheduled none.
- A second note due at 12:00, app sent home, then `adb reboot`. The app
  was not opened after the reboot. At 22:56 UTC the alarm was back,
  exact and unchanged, restored by expo's boot receiver. It fired at
  23:00 UTC, and the shade showed "Verify reboot alarm / Due".
- Evidence: `app/build/verify/evidence/android-20261111-224320/`
  (`ring-before-reboot.png`, `ring-after-reboot.png`, `reboot-proof.txt`).
- Limit: the emulator reverted its zone to UTC across the reboot, and
  the screenshots prove delivery, not sound or doze behavior. Sound was
  not captured. That stays a phone check.

The spawn of a recurring task still copies a timed due into
`reminders` (`use-toggle-task.ts`). That copy is now redundant, and the
whole-minute dedupe keeps it to one ring. It stays because this ticket
does not change the spawned note shape.

Merged as `09b88d3`. The verifier passed eight checks. It ran the new
tests against the base commit and saw exactly six fail, matching the
report. It also confirmed the minute bucket cannot drop a reminder one
minute later, because a stored value never carries seconds.

Two evidence notes. The saved dumpsys files bracket the run but do not
contain the two restored-alarm lines quoted in the proof text; the
screenshots carry the delivery proof. The evidence APK came from
`5357916`, the commit before the rebase, so it is not byte-identical to
the merged head, though the rule code is the same.

Risks that stay open. Sound, doze and battery saver on the real phone
are unproven, and so is a real timezone change. Two different reminders
in the same minute would ring once; the app cannot write that today. A
hand-written due with a `Z` or an offset reads as undated and stays
silent.
