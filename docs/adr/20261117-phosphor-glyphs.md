# Phosphor draws the app's glyphs

- **Status:** accepted
- **Date:** 2026-11-17

## Context

The app drew its icons from Views: a few bordered boxes and dots per
glyph. The outline forms read poorly. At 10 to 24 points, a 1.5pt border
turns a page into a plain rectangle. Only the sort and overflow controls
had a filled form, so a selected control could only change color.

The operator's other app, Monkey Budget, uses Phosphor for the same
job (its ADR 0016). Every Phosphor glyph ships two drawings: an outline
named `regular` and a solid one named `fill`. The set is free, MIT
licensed, and its drawings live on one 256 square grid.

## Decision

The app draws Phosphor's geometry through `react-native-svg`. A
generator under `app/scripts/icons/` reads the `regular` and `fill`
paths from `@phosphor-icons/react`'s def files, a dev dependency, and
writes the committed table `src/components/ui/glyphs.ts`. A test fails
when the table drifts from the package. A new glyph is one line in the
generator's map, then `npm run icons:build`.

We rejected an icon font, including `@expo/vector-icons`. A font carries
one drawing per name. It cannot switch a glyph from outline to fill.
Its glyphs take a flat color with no per-path control, and it adds font
assets and a load step. `react-native-svg` draws the path data
directly, so both weights share one box and scale crisply at any size.
The cost is one native module, which the release APK already rebuilds.

The navigation drops its visible labels. The selected tab draws the
fill weight in the accent color. The other tabs draw the outline in
muted ink. The label stays as the accessibility name, and `aria-selected`
stays on the tab.

The bar's row drops from 52 to 48 points. The icon alone needs less
height than an icon over a label. The Add control stays 48, and each tab
keeps its 44pt target.

## Consequences

The web build's bar is 65 pixels tall instead of 69. That is a 48pt row,
8pt of padding above and below, and the 1px hairline. Measured at 360
and 412 wide, in the budget and midnight palettes.

Every glyph now has a filled form, so any control can show a selected
state without a second asset.

Phosphor's drawings carry an 8pt inset on the 256 grid. A glyph in a
20pt box reads a little smaller than the old full-bleed drawing. The
box stays the same, so layout does not move. The glyph table records
the box each name already had.

The vendored table is about 13KB and ships no runtime dependency on
`@phosphor-icons/react`. A package bump needs one generator run, and the
drift test says when.

`react-native-svg` is a native module. Expo Go cannot load it, so use a
development build or the local release APK. The browser preview and the
end-to-end suite run its web build.
