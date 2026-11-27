---
title: Capture's add, list and reference controls look right
created: 2026-11-26
priority: normal
assignee: lane capture-controls
pr:
depends: []
---

## Spec

The operator's feedback on 2026-11-26, about adding a task in Lists.

- The add button's icon is ugly.
- The button that switches the list is too big, and its corners are
  too round.
- The reference control is too big, and sits on a second row. Put it in
  the same row as the list button.

The controls live in `features/capture/components/`. Show the operator
two designs at phone width before building, with the app's palette.

## Acceptance

- [ ] The operator picks a design from frames.
- [ ] The list and reference controls share one row.
- [ ] Each control keeps a 44pt touch target.
- [ ] Emulator frames before and after.

## Outcome

(filled in before moving to done/)
