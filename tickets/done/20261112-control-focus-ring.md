---
title: Give press targets a visible focus ring
created: 2026-11-12
priority: high
assignee: omp
pr: 137
depends: []
---

## Spec

The component gallery, ticket 20261112, shows a gap. `Pressable`,
`IconButton` and `Button` paint no focus style on web. A keyboard user
tabs through the app with no visible focus. Only `TextField` shows a
ring, and that ring is the browser's own input outline. `CommandPane`
has an accent edge on its search field, so it is the one surface that
draws its own.

This fails the Focus Visible rule of the Web Content Accessibility
Guidelines (WCAG 2.4.7, level AA). The gallery cannot catch focus drift
on those primitives until they paint a mark. Its two focused cells are
labelled "focused, no ring" for that reason.

`Pressable` is the shared press primitive. `Button` and `IconButton`
both build on it, and so does most of the app. A ring added there
reaches every press target at once. Do not put a ring on only the
gallery's cell.

## Rules the ring must satisfy

- It sits inside or just around the 44pt target. It must not clip
  against a parent edge and must not widen the layout.
- It is visible on both `paper` and `surface`, in all four palettes, at
  3 to 1 or better against both.
- It does not appear on a mouse press. The browser's `:focus-visible`
  test is the signal, or the same state through a keyboard event.
- It does not move the pressed or selected mark. Ticket 0082 owns those
  marks, and this ring should fit beside them.
- Native keeps its current behaviour. A touch screen has no focus ring.

## Acceptance

- [x] One focus mark in `components/ui/pressable`, drawn by every press
      target that builds on it.
- [x] `Button`, `IconButton` and the task row show it on keyboard focus.
- [x] A component test proves the mark appears for keyboard focus and
      not for a mouse press.
- [x] The gallery's focused cells for pressable and icon button draw the
      mark, and their labels drop "no ring".
- [x] A Playwright check tabs to a control, asserts the mark, and runs
      axe clean in every palette.
- [x] Contrast at 3 to 1 or better against `paper` and `surface` in all
      four palettes.
- [x] `npx tsc --noEmit`, `npx eslint src scripts e2e --max-warnings 0`,
      `npx vitest run` and the e2e pass.

## Outcome

The shared press draws one focus mark on the web, so every press target
has it: `Button`, `IconButton`, the tab strip, the segmented control, the
task row, the menu rows and the command rows. Native keeps its touch
behaviour and paints no ring. ADR `20261112-control-focus-ring` records
the recipe and the rejected options.

The mark is two colors, both inside the target. A 2 px ring in the
palette's new `focusRing` sits at the edge, and a 2 px `onAccent` band
sits inside it. One of the two always reads. No single color clears 3 to
1 against both a light ground and an accent fill. The contrast test holds
the ring at 3 to 1 against `paper`, `surface`, `accentSoft` and
`pressed`:

| Palette | paper | surface | accentSoft | pressed |
|---|---|---|---|---|
| budget | 10.92 | 11.48 | 9.21 | 9.82 |
| todoist | 5.11 | 5.33 | 4.54 | 4.69 |
| clay | 5.39 | 5.69 | 4.74 | 4.93 |
| midnight | 10.27 | 9.51 | 8.17 | 8.62 |

Modality is the browser's own test. The press reads
`element.matches(":focus-visible")` in its focus handler, and a
`pointerdown` clears the mark. The press also sets `outline-style: none`
when the mark is off, because Chrome keeps its focus-visible verdict
after a press on an already focused control. A disabled target never
draws it. If the selector is unknown, the handler draws the mark instead
of throwing, and a test holds that path.

The gallery's two focused cells drop "no ring" and follow the keyboard.
The auto-focus wrapper is gone. A browser holds focus on one control, so
it focused three cells in turn and only the last one kept focus, which
made the page look focused while two cells were not. The spec tabs to
each focused cell, asserts the mark's color and 2 px width, clicks one
and asserts the mark drops, and keeps a close shot of each focused press
target as review evidence. The gallery ADR carries a dated amendment.

Gates: `npx tsc --noEmit` clean.
`npx eslint src scripts e2e --max-warnings 0` clean.
`npx vitest run` passes 96 files and 842 tests.
`E2E_PORT=8611 npm run e2e` passes 466 tests with 26 skipped and no
failures. The axe scan in the gallery spec reports nothing serious or
critical in budget, todoist, clay and midnight at 360 and 412 wide.

PR: #137.
