# Icon buttons carry their state in the glyph

- **Status:** accepted
- **Date:** 2026-11-16

## Context

Ticket 0082 found two wrong selected states. One was the Lists sort
button. Its active state was a 44pt `accentSoft` square drawn by
`IconButton`. The square's bottom edge met the header's bottom edge, so
the mark read as clipped. The tap target and the mark were the same
box.

The operator split the ticket. Direction C (Ink) covers the week drop
target, which a separate change builds. This record covers icon
buttons only.

Two options existed for the button. Keep the box and inset it from the
band edge. Or move the state onto the glyph and keep the button ground
clear. The second option reuses the reference the app already trusts:
`monkey-budget` switches its navigation icons from regular to fill.

## Decision

An icon button paints no state box. Hover and press keep the quiet
`pressed` ground. The 44pt target stays, and the visible mark sits
inside it with room to spare.

The glyph carries the state. It draws as an outline at rest and as a
filled mark when selected. One weight type, `GlyphWeight`, and one
`weight` prop on `Icon` serve both marks. The outline keeps the tint
`inkMuted`. The filled mark uses `ink`, so the state reads by shape and
by contrast.

For the Lists sort button, selected means the menu is open or the sort
is not the default. One filled state covers both, as the earlier active
box did. The menu button fills while its menu is open.

Every other surface keeps its current state mark. Tabs, the segmented
control, pills, list rows, the month grid and the period strip do not
change. A glyph with no fill variant cannot show this state. A filled
glyph is not a substitute for a selected tab.

## Consequences

No mark can touch the band edge, because the button box no longer
paints. The button keeps its size, so no state shifts the layout. A
glyph's outline and fill share one outer box.

The filled mark clears 3 to 1 against `surface` in every palette. In
budget it reaches 15.12 to 1. Todoist gives 16.66, clay 13.67 and
midnight 15.16. The outline keeps at least 5.43 to 1.

The state costs a second drawing of each mark. Only marks that carry
state need one, and the icon set grows a pair at a time. A filled glyph
that also needs a color change is two props, so a caller can get one
wrong. The gallery shows both states next to each other to keep that
visible in review.
