# The status bar follows the palette

- **Status:** accepted
- **Date:** 2026-11-18

## Context

The app never set a status bar style. The generated Android theme has
no `windowLightStatusBar` value, so the platform keeps its default of
light icons. On the cream palettes the clock, the signal bars and the
battery vanish against the page.

The app has four palettes and one of them, Midnight, is dark. A fixed
style cannot serve both grounds.

## Decision

Render `expo-status-bar`'s `StatusBar` once, from the root layout. Its
style comes from the active palette name. Midnight gets light icons and
the other three get dark icons. The native start is `style: dark`, set
through the plugin, so the white splash and the first frame are right.

The bottom system navigation strip stays out of this. Ticket 0046 and
PR 46 own it, and the operator has not decided it.

## Consequences

A theme switch repaints the icons in place, because the bar sits inside
the theme provider.

Midnight shows dark icons for the moment between the splash and the
first render. One native start value cannot know the saved palette. The
flash lasts a frame or two and costs less than a wrong bar on three
palettes.
