---
title: Give press targets a visible focus ring
created: 2026-11-12
priority: high
assignee:
pr:
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

- [ ] One focus mark in `components/ui/pressable`, drawn by every press
      target that builds on it.
- [ ] `Button`, `IconButton` and the task row show it on keyboard focus.
- [ ] A component test proves the mark appears for keyboard focus and
      not for a mouse press.
- [ ] The gallery's focused cells for pressable and icon button draw the
      mark, and their labels drop "no ring".
- [ ] A Playwright check tabs to a control, asserts the mark, and runs
      axe clean in every palette.
- [ ] Contrast at 3 to 1 or better against `paper` and `surface` in all
      four palettes.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e --max-warnings 0`,
      `npx vitest run` and the e2e pass.

## Outcome

(filled in before moving to done/)
