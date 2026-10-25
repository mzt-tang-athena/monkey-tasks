---
id: 0038
title: The bottom bar and the capture sheet are too small to hit
created: 2026-10-24
priority: normal
assignee: omp
pr: 60
depends: [0028]
---

## Spec

Reported on the phone on 2026-10-24. The bottom bar is cramped, the
Add button is small, and the capture input and its text are smaller
than the space allows. Todoist is the reference: a taller bar, a large
round Add button, and a capture field that fills the sheet.

The bar sits over the system navigation strip, so the extra height
must not push the list off screen or hide a row behind it.

## Acceptance

- [ ] The bottom bar's nav row is taller, with the labels and the Add
      button keeping their alignment.
- [ ] The Add button is at least 48 by 48, and its icon and label scale
      with it.
- [ ] Every control in the bar has a touch target of at least 44 by 44.
- [ ] The capture input and its text are larger, with more line height,
      and the sheet uses the height it has.
- [ ] The bar stays one row at 320 px width, and the capture sheet fits
      the smallest screen.
- [ ] Sizes come from theme tokens, not literals in the screen files.

## Outcome

The bar's row is 52pt tall (56 in the first pass, shortened by
0042). Each nav item is a 56 by 44 target, the
Add control is 48 tall with an 18pt plus and a 16pt label, and the
toast actions clear 44 by 44. The labels grew to 12pt and the glyphs
to 20pt so nothing looks lost in the taller row.

The capture input is 17pt on a 24pt line, with 52pt of minimum height
and 12pt of padding. The send circle and the target pill are 44pt. The
input still grows with its text, but its cap is now the smaller of 40
percent of the window and the window less 400pt. That reserve covers a
keyboard and the panel's chrome, so a long capture fits a 320 by 568
screen.

The sizes live in three new tokens: `touchTarget`, `bottomBar`,
`captureText`, plus `sheetReserve`. The bar's bottom gutter now uses
`spacing.s` instead of a literal.

Verified in the web preview at 390 by 800, 320 by 640 and 320 by 568.
Measured: Add 87 by 48, each nav item 56 by 44, send 44 by 44, target
pill 58 by 44, input 17pt on a 24pt line. The bar stays one row at 320.
A long capture caps at 168pt on the 568 screen and scrolls inside its
box. The bar sits in the column, so the list ends above it. The phone
check is the user's.
