---
id: 0010
title: Lists route
created: 2026-10-20
priority: high
assignee: omp
pr: 34
depends: [0009]
---

## Spec

The first tab: Google Tasks-style lists, per the 2026-10-20 brainstorm.

- Tab bar across the top: `Focus` and `Main` first; creating a list adds
  a list note in `Tasks/Lists/`.
- Main is the default bucket and is never stored: a task with no
  `lists` property shows on Main. Capturing on Main writes nothing;
  capturing on a list writes that list into the task's `lists`.
  Moving a task Main-to-list adds the list.
- Persistent capture: a floating button on every screen opens a
  capture sheet. The sheet holds input, a target-list chip (preselected:
  current list, or Main elsewhere) and send. The existing offline NL parsing applies.
- Rows: tick writes `completed`; untick removes it. Sort sheet:
  Date (grouped Past in red, Today, upcoming days, No date; Completed
  faded at the bottom) and Title. Alphabetical order breaks ties
  inside groups. The sort sheet does not offer it.
- Focus behaves like any list. Hand ordering ("My order") belongs to a
  later ticket (0014) and stays out of this one.

## Acceptance

- [x] Focus and Main tabs exist
- [x] Creating a list note adds a tab.
- [x] capture from any screen lands on the chip's target; Main
      targets write no lists property
- [x] ticking writes `completed`, unticking removes it
- [x] Date sort groups Past (red), Today, upcoming days, No date,
      with Completed faded last

## Outcome

The tab bar reads `Tasks/Lists/` and derives one tab per list note,
after Main. Focus is one of those notes rather than a fixed tab (ADR 0015
amendment). Main shows every task. Capture targets follow the tab
order, so a capture on a list tab writes that list.

A list note that fails validation shows under Needs repair and never
hides the other tabs (0033). List creation from the app waits for the
command pane.

Sort, tick and capture shipped earlier and have not changed.
