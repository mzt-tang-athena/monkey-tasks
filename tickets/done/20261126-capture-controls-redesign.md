---
title: Capture's add, list and reference controls look right
created: 2026-11-26
priority: normal
assignee: lane capture-controls
pr: 265
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

- [ ] The operator picks a design from frames. (Not yet: built A, the recommendation, and the frames are in the PR.)
- [x] The list and reference controls share one row.
- [x] Each control keeps a 44pt touch target.
- [x] Emulator frames before and after.

## Outcome

Built design A: 32pt chips with 6pt corners inside 44pt targets. The
list switcher ends in an up-down caret, and the link control is a
glyph. Both sit in one row with Send, and an attached link joins that
row. Send draws a Phosphor arrow-up in place of the text arrow. The
Pill and Button changes also reach the journal sheet's Food chip and
Send, so the two sheets match. The operator's pick is still open.
