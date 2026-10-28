# 0040. Type scale and layer order

- **Status:** accepted
- **Date:** 2026-10-28

## Context

The screens set text size by hand. At commit `b2c0b10` they held 86
`fontSize` literals in 11 sizes, from 10 to 26. The eyebrow label over
a group came in five forms: 12 or 11 pt, weight 600 or 700, and letter
spacing 0.5, 1 or 1.2. Nothing said which size a new label should take.

Surfaces that float had no order either. The drag ghosts, the menus,
the toast and the capture sheet stack in tree order. One ghost sets
`zIndex: 20`. The `elevation` values reorder the rest, on Android only.
A menu's backdrop sits under the Lists page body, so a tap outside the
menu reaches the row under it on the web.

Ticket 0054 adds the shared UI primitives that the screen tickets
(0055 to 0057) adopt. They need one scale and one order to build on.

## Decision

We name eight type steps by role in `src/theme/tokens.ts`. Each step
is a size and its line height:

| Step | Size / line | Role |
|---|---|---|
| `eyebrow` | 12 / 16, weight 700, spacing 1, capitals | Labels over groups and fields |
| `caption` | 11 / 14 | Chips, week cards, ruler marks, hints |
| `meta` | 13 / 18 | A row's time, banners, toasts |
| `control` | 14 / 20 | Buttons, menu items, pills |
| `body` | 16 / 22 | Running text, field values, empty states |
| `bodyLarge` | 17 / 24 | Task names, list tabs, the capture input |
| `title` | 22 / 28 | A screen's own heading |
| `display` | 26 / 32, serif | The date on the day view |

A style spreads a step and adds its own color and weight. The eyebrow
is a whole form, so it carries its weight, spacing and case. The scale
drops 10, 15 and 18. When a screen adopts the scale, a 10 becomes a
caption, a 15 becomes body, and the week view's 18 pt serif day number
becomes a title or stays a local exception with a comment.

We name one z scale, `layers`, low to high: content 0, bottom bar 10,
drag ghost 20, menu backdrop 30, menu 40, sheet scrim 50, sheet 60,
toast 70. `OverlayHost` wraps the stack in `src/app/_layout.tsx`. An
`Overlay` draws its children there, in a layer that fills the window,
with `zIndex` and `elevation` both set to the layer value. Android
orders siblings by elevation first, so the two must agree.

We rejected sizes named by number (`size13`), because a number says
nothing about where it belongs. We rejected a scale per screen, because
the drift came from exactly that. We rejected a portal library: the
host is about 120 lines and adds no native code.

## Consequences

A new label picks a role, not a size. The screen tickets move their
literals onto the steps as they adopt the primitives. Some text moves
by a point when it does: the menu hints and the editor's field hints go
from 12 to 11, and the empty states go from 15 to 16. Those tickets
check the change in their screenshots.

The toast floats above an open sheet, and a menu floats above the
bottom bar. A menu, a sheet and a toast all reach the window edges,
whatever screen opened them.

An overlay renders inside the host, not inside the screen that opened
it. It sees the app's providers, such as the task store and the safe
area, but not a provider the screen adds for itself. A screen passes
such values as props.

While a modal overlay shows, the host hides the screen from assistive
tech: `aria-hidden` on the web, `no-hide-descendants` on Android. The
overlay itself stays readable.
