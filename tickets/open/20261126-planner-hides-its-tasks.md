---
title: The planner can hide its task half
created: 2026-11-26
priority: normal
assignee:
pr:
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
- [ ] The control hides and shows the task half in each view.
- [ ] The choice survives a restart.
- [ ] Emulator frames hidden and shown.

## Outcome

(filled in before moving to done/)
