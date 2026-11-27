---
title: The planner can hide its task half
created: 2026-11-26
priority: normal
assignee: claude-code planner-hides-tasks lane
pr: 266
depends: []
---

## Spec

The operator's feedback on 2026-11-26. The planner's bottom half lists
the tasks under the calendar. Add a control that hides it, so the
calendar takes the whole screen, and shows it again.

The operator asked where the control should go. Propose two or three
places with frames, and the operator picks. Candidates:

- A tap on the split handle between the halves.
- A chevron beside the "Due today" title.
- The command pane.

Tickets `20261124-week-and-month-split-drags` and
`20261121-day-split-range-on-android` touch the same split. Say how
hiding fits a drag.

## Acceptance

- [ ] The operator picks the control's place from frames.
- [x] The control hides and shows the task half in each view.
- [x] The choice survives a restart.
- [x] Emulator frames hidden and shown.

## Outcome

We drew three placements at phone width. A is a tap on the split
handle. B is a chevron beside the list title. C is a command in the
command pane. The frames are `placement-{A,B,C}-week.png` in the lane's
evidence folder. The operator had not picked when this shipped, so we
built A, the recommended one. The first box stays open for that reason.
If the operator picks B or C, a dated amendment to ADR
`20261127-planner-hides-its-tasks` and a follow-up ticket move the control.

A tap on the handle hides the list in Day, Week and Month. The calendar
takes its room. The choice is the `plannerTasks` setting and survives a
reload and an app restart. Enter on the handle does the same. The hide
runs on the UI thread, and reduced motion lands it at once.

Hide is a state apart from the split share. Day keeps its share through
a hide, and a drag works only while the list shows. The drag tickets
need no hidden case.

Proof: `planner-hide-tasks.spec.ts` in both motion projects, and
`journeys/android-planner-hide.sh` on the emulator (port 5584). A tap on
the device first read as a cancel, so a separate tap gesture now toggles.
