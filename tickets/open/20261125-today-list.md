---
title: A Today list, switched on or off in Settings
created: 2026-11-25
priority: normal
assignee:
pr:
depends: []
---

## Spec

The operator's feedback on 2026-11-25: Lists gains a Today list, and
Settings can add or remove it. A Kanban list follows in its own ticket.

- Today shows the tasks due today. Propose whether overdue tasks join
  it, the way TickTick's Today does. The operator confirms.
- Today is a built-in list, like Main. It writes no `list`
  value into a note, so the vault needs no schema change.
- Settings gains a place for optional built-in lists. Today is the
  first one there. Place its tab beside Main, in the sequence
  `features/lists/hooks/use-list-tabs.ts` builds, and say where.
- Capture from the Today list sets today's date on the new task.

## Acceptance

- [ ] The operator confirms what Today holds.
- [ ] Settings switches Today on and off, and the choice persists.
- [ ] Today lists exactly the tasks the rule names.
- [ ] Capture on Today dates the task today.
- [ ] Web e2e in both motion modes, plus emulator frames.

## Outcome

(filled in before moving to done/)
