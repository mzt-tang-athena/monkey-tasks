# Name the spacing and radius scale

- **Status:** accepted
- **Date:** 2026-11-12

## Context

Type, color and motion are named scales. Spacing and radius are only
partly named. `spacing` holds 4, 8, 12, 16, 24, 32 and 48. `radius` is 6.
Features still wrote raw padding, gaps and corners. The largest were a
6pt gap, a 10pt and 14pt button padding, a 15pt top pad, and a 4.5pt and
5pt glyph curve. Nothing stopped a new raw number.

## Decision

We keep the 4pt layout scale at seven steps. We do not add a step for
every stray value. A layout value at or above 4 rounds to the nearest
step. A 6 gap becomes 8. A 10 and 14 button padding becomes 12 and 16.
A 15 top pad becomes the row pad plus a 3pt mark.

Marks under 4 stay literal. They trace a glyph, a rule or a swatch, not
a rhythm. A shape that must read as fully round uses `radii.pill`.

A vitest guard scans `app/src/features`, `app/src/components` and
`app/src/app`, where Expo Router keeps the screens. It fails a raw
`padding`, `margin`, `gap` or `borderRadius` literal whose size is 4 or
more, whether positive or negative. A list beside the test holds
exceptions, each with a reason. Computed values, variables,
`StyleSheet.hairlineWidth` and the token file are skipped.

We rejected a token for 6, 10 and 14. Each screen would then add its own
number, and the scale would stop guiding a choice. We rejected a runtime
check. A test runs in the existing vitest job and needs no new CI job.

## Consequences

New layout code chooses a named step. The diff is a small rounding, not
a restyle. Three 6pt gaps widen by 2pt, and the diagnostics buttons grow
by 2pt on each side.

Glyph geometry keeps its own numbers. The guard lists two icon
exceptions: the 4pt gap between glyph strokes, and the calendar frame's
5pt curve. A new exception needs a reason in the allowlist.
