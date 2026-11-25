---
title: A Today list, switched on or off in Settings
created: 2026-11-25
priority: normal
assignee: opencode
pr: 235
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

- [x] The operator confirms what Today holds.
- [x] Settings switches Today on and off, and the choice persists.
- [x] Today lists exactly the tasks the rule names.
- [x] Capture on Today dates the task today.
- [x] Web e2e in both motion modes, plus emulator frames.

## Outcome

Shipped in #235.

Today is a built-in list that leads the tabs. It holds today's tasks
from the planner's day rule, with the overdue ones in a Past group
above them. A tick leaves it, and a capture taken there is due today.
Settings has a Built-in lists section with a Today switch, stored as
on/off. Main leads again once the switch goes off. A fresh start lands
on the first tab, so it opens on Today while the switch is on.

The Board row and tab wait for the Kanban ticket, which the ADR places
after Main.
