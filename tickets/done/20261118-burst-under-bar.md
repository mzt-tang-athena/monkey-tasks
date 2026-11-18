---
title: A page tick's burst stays under the bottom bar
created: 2026-11-18
priority: high
assignee: omp
pr: 163
depends: []
---

## Spec

On the web preview, 412 wide, the bar's top edge sits at y=846. Tick a
list row whose circle sits just above the bar. Its green burst dots
paint at y 848 to 851. The dots land on top of the bar. The completion
celebration ADR says a page tick's burst sits under the bar. The code
disagrees. The burst draws in the overlay host, above every screen. The
bar lives inside the screen. As a result, `layers.bottomBar` (10) never
orders the two.

Fix the design, not the number. A page tick's burst must never paint
over the bottom bar or its safe-area band. The editor sheet's burst
still draws above the sheet. Menus, sheets and toasts still draw above
a page burst. Reduced motion still draws nothing.

Record the trade-off as a dated amendment to
`docs/adr/20261116-completion-celebration.md`.

## Acceptance

- [x] A list row whose circle sits just above the bar shows no burst
      pixel inside the bar's box.
- [x] The editor sheet's burst still draws above the sheet.
- [x] Menus, sheets and toasts still draw above a page burst.
- [x] Reduced motion draws no burst.
- [x] A web e2e case in `celebration.spec.ts` fails on the base commit
      and passes after the fix.

## Outcome

Fixed in #163. The bar reports its measured height, safe-area band
included, to a root provider. The page burst layer clips at that
height. No burst paints over the bar now. The sheet burst keeps its
own layer.

The new e2e case in `celebration.spec.ts` failed on the base source with
an overlapping burst box and bar box. It passes with the fix in both
the motion and reduced-motion projects. The full web suite had 580
passed and 26 skipped. `tsc`, eslint and 1133 unit tests passed. The
celebration ADR has a dated amendment with the design and its
trade-offs.
