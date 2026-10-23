---
id: 0010
title: Lists route
created: 2026-10-20
priority: high
assignee:
pr:
depends: [0009]
---

## Spec

The first tab: Google Tasks-style lists, per the 2026-10-20 brainstorm.

- Tab bar across the top: `Focus` and `Main` first; lists are created
  as list notes in `Tasks/Lists/`.
- Main is the default bucket and is never stored: a task with no
  `lists` property shows on Main. Capturing on Main writes nothing;
  capturing on a list writes that list into the task's `lists`.
  Moving a task Main-to-list adds the list.
- Persistent capture: a floating button on every screen opens a
  capture sheet: input, target-list chip (preselected: current list,
  or Main elsewhere), send. The existing offline NL parsing applies.
- Rows: tick writes `completed`; untick removes it. Sort sheet:
  Date (grouped Past in red, Today, upcoming days, No date; Completed
  faded at the bottom) and Title. Alphabetical order is the tiebreaker
  inside groups, not a sort option.
- Focus behaves like any list; hand ordering ("My order") is a later
  ticket (0014), not here.

## Acceptance

- [x] Focus and Main tabs exist
- [ ] Creating a list note adds a tab. The tabs are the fixed pair
      `"Focus" | "Main"` today; nothing reads `Tasks/Lists/`.
- [x] capture from any screen lands on the chip's target; Main
      targets write no lists property
- [x] ticking writes `completed`, unticking removes it
- [x] Date sort groups Past (red), Today, upcoming days, No date,
      with Completed faded last

Remaining work: derive the tab set from the list notes in
`Tasks/Lists/`, so a new note becomes a tab and a deleted note drops
one.
