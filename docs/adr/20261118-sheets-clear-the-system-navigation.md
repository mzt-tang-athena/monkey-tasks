# Sheets clear the system navigation

- **Status:** accepted
- **Date:** 2026-11-18

## Context

Android 15 and later draw every app edge to edge (ADR 0014). The
window reaches the bottom of the screen, and the system navigation draws
over it. A phone
with gesture navigation has a thin inset for the gesture bar. A phone
with three-button navigation has a bar of about 48dp.

The shared sheet docked its panel 8pt above the bottom of the window. It
never read the bottom safe-area inset. On the operator's phone the task
editor ran under the back, home and recents buttons. The buttons cut its
last row in half.

The bottom bar already handles this. It pads itself by the inset and
draws a dark band behind the system buttons.

## Decision

The shared `Sheet` reads the bottom safe-area inset. Its dock sits 8pt
above that inset, so the whole panel stays clear of the system
navigation. Every sheet gets this, because every sheet uses `Sheet`.

The scrim still covers the full window, the inset included. The page
stays dimmed down to the system bar, and the system buttons stay
readable over it.

The keyboard and the inset add up. The keyboard library reports its
height above the navigation bar. The panel stays above the keyboard when
it opens. In gesture navigation the keyboard covers the navigation area.
The panel then keeps one extra gesture inset of air above it.

We rejected padding each caller's content by the inset. Seven sheets
would each need the same line, and one missed caller brings the fault
back. The panel's own edge would also still sit under the buttons.

We rejected a scrim that stops at the inset. It leaves an undimmed
strip under a dimmed page, and a hard line across the sheet's shadow.

## Consequences

New sheets inherit the placement. A caller places its content against
the panel's edge and needs no inset of its own.

On iOS the inset covers the home indicator. With the keyboard open the
panel floats one indicator inset higher than it needs to. We accept
that until iOS ships.

The drag to close did not change. The drag moves the panel inside the
dock, so the inset and the drag never share a style.
