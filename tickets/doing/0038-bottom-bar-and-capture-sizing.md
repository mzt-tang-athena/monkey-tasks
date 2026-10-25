---
id: 0038
title: The bottom bar and the capture sheet are too small to hit
created: 2026-10-24
priority: normal
assignee: omp
pr:
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

(filled in before moving to done/)
