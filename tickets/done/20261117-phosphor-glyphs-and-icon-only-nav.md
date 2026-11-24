---
title: Phosphor glyphs and an icon-only nav
created: 2026-11-17
priority: high
assignee: omp
pr: PRNUM
depends: []
---

## Spec

The app draws its icons from Views in `components/ui/icon.tsx`. The
outline forms read poorly: a 1.5pt border on a 20pt box leaves shapes that
look like stray rectangles. The navigation also wastes a line on a label
under each glyph, and the operator knows what each tab is.

Replace the hand-drawn glyphs with Phosphor's geometry, in both weights.
Phosphor ships an outline (regular) and a filled drawing for every glyph.
The selected state then gets a real fill, not a colour change on a hollow
shape.

Vendor the path data. A generator under `app/scripts/icons/` reads
`@phosphor-icons/react`'s def files and writes a committed table. The
table is the artifact; the generator is how a future agent adds a glyph.
Render with `react-native-svg`, added through `npx expo install` so the
version matches Expo.

Then drop the visible labels from the bottom bar. The selected tab uses
the fill weight and the accent colour. The bar's row drops from 52 to 48,
which keeps the Add control's 48 and the 44pt touch target.

Add an Icons section to the gallery so the set is reviewable in the four
palettes. Extend the gallery spec to walk it.

## Acceptance

- [ ] `Icon` keeps its public API: `name`, `weight`, `color`, `size`, and
      the testIDs `icon:<name>` and `icon:<name>:fill`.
- [ ] Every `IconName` has a regular and a fill drawing from Phosphor.
- [ ] The glyph table carries Phosphor's MIT licence and attribution.
- [ ] The nav tab shows no visible label. `accessibilityLabel` and
      `aria-selected` still name each tab.
- [ ] The selected tab draws the fill weight in the accent colour.
- [ ] `bottomBar.row` is 48. The tab keeps a 44pt target and three tabs
      plus Add fit at 360.
- [ ] The gallery draws every glyph in both weights at its real size.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e --max-warnings 0`
      and `npx vitest run` pass in `app`.
- [ ] The gallery, capture-dock and a11y specs pass at 360 and 412.
- [ ] An ADR records the source, the generator, the licence and the bar
      height change.

## Outcome

Done before this close. PR #157 (`62a6799`) landed the glyphs, the label drop, the 48 row, the gallery section and the ADR. Closed in the 2026-11-24 ticket sort.
