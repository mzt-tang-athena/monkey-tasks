# The component gallery is a dev route

- **Status:** accepted
- **Date:** 2026-11-12

## Context

The app had 15 primitives in `app/src/components/ui` and no review
surface. A state drifted until someone saw it on a real screen. Ticket
0082 exists because selected and active states drift. The e2e suite had
no pixel check either.

A gallery is only useful if it renders what ships. A copy of a button
with its own styles reviews nothing. It must also be reviewable in every
palette, and a state must be checkable by a machine, so drift fails CI
instead of a review.

Overlay surfaces are the hard case. A menu, sheet, command pane and toast
each need the real `OverlayHost`. An open modal marks the page behind it
`inert`. Assistive tech then skips that page, and axe reports nothing
about it.

## Decision

`app/src/app/gallery.tsx` re-exports `features/gallery`. Settings >
Diagnostics gains one link to it. The bottom bar never gets one.

`features/gallery/model.ts` holds the matrix: a section per primitive and
a state per row. The screen maps every state id to one node, so a state
without a node fails the type check. The Playwright spec imports the same
model, so the page and its check walk one list.

The gallery draws every in-flow state at once, in page order. The four
overlay states open one at a time from a button in their own cell. Each
one still draws through the app's `OverlayHost`. We rejected drawing them
open at rest because the page goes inert and axe stops reading it. We
rejected rendering them without a host because that reviews a different
component.

Palette comes from the provider. The spec switches it through
`globalThis.__setTheme`, the hook the web build already exposes. A
reviewer can also open `/gallery?palette=clay`.

The spec takes one screenshot per palette at 360 and 412 wide. It grows
the window to the page's full height first and asserts that nothing is
clipped. It scans axe in every palette, checks the 44pt floor and walks
every state id.

## Consequences

State drift shows up in review and in CI. A new state is one row in the
model and one node in the screen, and the spec covers it without a new
test.

The screenshots depend on the machine's fonts. We start with pixel
baselines and keep them only if the CI runner reproduces the same
pixels. If it does not, the screenshots stay as review artifacts and the
spec asserts geometry and colour instead.

Two cells are exempt from the contrast rule. WCAG exempts disabled text,
and the faint step is the receding mark for done work. Both sit below 4.5
to 1 by design. The spec names the two cells, so no other cell escapes
the rule.

Only one control can hold focus at a time, so the focused cells ring in
Tab order. A reviewer presses Tab to see each one.

The gallery ships in the bundle. It has no production entry point.
