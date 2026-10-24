---
id: 0036
title: A task note that fails validation shows as a repair row
created: 2026-10-24
priority: high
assignee: omp
pr:
depends: [0033]
---

## Spec

The task loader drops a note that fails validation. The row vanishes
from the list with no trace, so the task reads as lost. 0033 fixed the
same silence for list notes: they show in a `Needs repair` block with
their file name and errors. Do the same for tasks.

An invalid task note shows as a read-only row. It carries its file name
and one line per error. It does not open, tick, drag, swipe or schedule.
The block sits above the list and never hides the valid rows or takes a
row slot of its own.

Out of scope: repair actions in the app. You fix the note in Obsidian.

## Acceptance

- [ ] An invalid task note shows a row with its file name and one line
      per error.
- [ ] That row does not open, tick, drag or swipe.
- [ ] Valid task notes look and act as they did.
- [ ] A test loads a vault with one invalid task note and finds the
      repair row.
- [ ] The repair block never hides the list.

## Outcome

(filled in before moving to done/)
