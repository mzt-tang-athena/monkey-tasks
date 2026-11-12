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

Pressable, IconButton and Button draw one focus mark on the web, in the
active palette (ADR 20261112-control-focus-ring). The text field keeps
the browser's own input ring. A browser holds focus on one control, so a
focused cell shows the mark only while the keyboard is on it. See the
second amendment below.

The gallery ships in the bundle. It has no production entry point.

## Amendment, 2026-11-12: the runner draws one glyph differently

The first CI run of the spec failed on all four 360 wide shots. The 360
budget image differed in 112 pixels, in two 11 by 10 boxes. One starts
at x 58, y 3694, the other at x 58, y 3998. Each box holds the check
glyph in a done row. The runner draws that glyph two pixels from where
this machine draws it. Every other pixel matched.

So we take the fallback in the decision above. The spec keeps no pixel
baselines. It asserts the palette's ground, fills and ink, the page's
width, every cell inside the page, and the section order. It still takes
one shot per palette and width. It writes the file to
`app/build/verify/evidence/component-gallery/` and attaches it to the
report, so a reviewer sees every state.

We rejected a tolerance of a few hundred pixels. That would have passed
the run, but it would call a baseline stable while a font shift moves
pixels inside it. The ticket asks for the same pixels or the fallback.

We also rejected a masked baseline, which hides the two glyph boxes and
compares the rest of the page. It would keep a real pixel check, but the
mask would follow a glyph whose position changes with content. The
fallback already asserts the paint and geometry a reviewer checks.

## Amendment, 2026-11-12: the focus cells draw the real mark

`Pressable` now draws a focus mark on the web, so every press target
inherits it (ADR 20261112-control-focus-ring). The paragraph above used
to say the focused cells showed no change and were labelled "focused,
no ring". That was true before the mark existed.

The cells no longer paint a copy of the mark. A browser holds focus on
one control, so two cells cannot both show a real ring at once. The
auto-focus wrapper is gone: it focused three cells in turn, only the
last one kept focus, and the page then called the other two "focused"
while they were not. A reviewer tabs to a focused cell and the mark
appears. The spec walks the same keyboard path, asserts the mark's
colour and 2 px width, presses one control with the pointer and asserts
the mark drops while the control keeps focus. It also keeps one close
shot of each focused press target as review evidence, because the page
shot at rest holds no focus.

We rejected keeping one cell focused on load. It would show one real
mark, but the other cells would still be unfocused under a label that
says "focused", and the page would take focus from a reviewer.
