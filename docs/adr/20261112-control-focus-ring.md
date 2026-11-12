# Press targets draw one focus mark

- **Status:** accepted
- **Date:** 2026-11-12

## Context

The component gallery showed that `Pressable`, `IconButton` and `Button`
paint no focus style on the web (ADR 20261112-component-gallery). A
keyboard user tabs through the app with no visible focus, which fails
WCAG 2.4.7 Focus Visible. A text field still showed the browser's own
input ring.

`Pressable` is the shared press primitive. `Button`, `IconButton`, the
tab strip, the segmented control and most of the app build on it. One
mark there reaches every press target.

A ring color must clear 3 to 1 against `paper`, `surface` and
`accentSoft`. A control can also sit on a solid `accent` fill, as the
primary button and the selected segment do. One color cannot serve both:
3 to 1 against `accentSoft` caps its relative luminance at 0.25 in
todoist and 0.23 in clay, while 3 to 1 against their accent fills needs
0.54 and 0.48. Midnight wants 0.16 or more against its dark soft fill
and 0.14 or less against its light accent. Only budget has a window, 0.220
to 0.226, too narrow to hit on purpose. An accent-filled control would
lose the whole mark.

## Decision

`components/ui/pressable.tsx` draws one mark, on the web only. The
native press keeps its current behaviour and paints no ring.

The mark is two colors, both inside the target:

- a 2 px ring in the palette's new `focusRing`, at the target's edge,
  held inside the box by `outlineOffset: -2`;
- a 2 px band of `onAccent` inside the ring, an inset box shadow.

One of the two always reads. On `paper`, `surface` and `accentSoft` the
ring color carries the mark. On an `accent` fill the ring color blends
and the `onAccent` band carries it, which is the same pair the button
label already uses. Both paint inside the target, so nothing moves and
no parent edge can clip the mark.

Modality is the platform's own test. The press reads
`element.matches(":focus-visible")` in its focus handler, and clears the
mark on `pointerdown`. The browser keeps its focus-visible verdict after
a press on an already focused control, so the press also sets
`outline-style: none` when the mark is off. That replaces the browser's
own ring instead of leaving one behind.

The palette gains `focusRing` in all four themes. The contrast test holds
the ring at 3 to 1 against `paper`, `surface`, `accentSoft` and
`pressed` in every palette. The measured values:

| Palette | paper | surface | accentSoft | pressed |
|---|---|---|---|---|
| budget | 10.92 | 11.48 | 9.21 | 9.82 |
| todoist | 5.11 | 5.33 | 4.54 | 4.69 |
| clay | 5.39 | 5.69 | 4.74 | 4.93 |
| midnight | 10.27 | 9.51 | 8.17 | 8.62 |

The `onAccent` band against `accent` is 10.92, 5.33, 5.56 and 10.27 in
the same order, and the text contrast test already holds that pair at
4.5.

We rejected one ring color. It cannot read on both the light grounds
and the accent fill.

We rejected a ring outside the target. It grows the painted area, and a
control in a tight cell clips it.

We rejected a stylesheet rule on `:focus-visible` with CSS custom
properties for the colors. It would drop the pointer handler, but jsdom
cannot compute that rule, so the component test would assert nothing,
and the provider ADR already keeps theming out of custom properties.

We rejected a hand-rolled keyboard tracker. The browser's own verdict is
already the answer, and a tracker would drift from it.

## Consequences

Every press target draws the mark on a keyboard focus, in the active
palette, with no per-component work. A new palette must name its
`focusRing` and clear the 3 to 1 set, so the mark cannot regress.

Native keeps its touch behaviour. A phone has no keyboard focus, so no
ring.

The browser's own outline is off on a press target on the web. The
shared mark is the only focus indicator there. A browser without
`:focus-visible` gets the mark on every focus, so a keyboard user never
loses it. No current browser takes that path.

A gallery cell can show a real mark only while it holds focus, because a
browser holds focus on one control (ADR 20261112-component-gallery, the
second amendment).
