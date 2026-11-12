---
title: Name the spacing and radius scale, and guard it
created: 2026-11-12
priority: normal
assignee: omp
pr: 132
depends: []
---

## Spec

The type, color and motion scales are tokens. Spacing and radius are only
partly tokens. `spacing` holds 4, 8, 12, 16, 24, 32 and 48. `radius` is
6. Features still carry raw values.

Measured on 2026-11-12 in `app/src/features` and `app/src/components`:

- `gap: 6`, `gap: 24`, `borderRadius: 6`, `borderRadius: 36`
- small marks at `borderRadius` 1, 1.5, 2, 3

Name the missing steps. Replace off-scale layout values with tokens. Add
a test that fails a raw `padding`, `margin`, `gap` or `borderRadius` value
at or above 4, with an allowlist for exceptions that carry a reason.

Fine marks under 4 may stay literal. A repeated one gets a named token.

This is not a restyle. The diff should read as rounding a stray value onto
the scale that already exists, and the screenshots should show only that.

The guard runs inside the existing vitest job. Do not add a CI job.

## Acceptance

- [x] Every raw layout value at or above 4 in features and components is
      a token or an allowlisted exception with a reason.
- [x] The test fails when a new raw value is added.
- [x] The token comments separate layout steps from marks.
- [x] Screenshots of the affected screens before and after.
- [x] `npx tsc --noEmit`, `npx eslint src scripts e2e --max-warnings 0`,
      `npx vitest run` and the e2e pass.
- [x] No new CI job.

## Outcome

The scale is named in `app/src/theme/tokens.ts`. The comments separate
layout steps from marks and record why 6 rounds to 8 instead of growing
the scale. No new numeric step was needed.

The measured tree differed from the ticket's 2026-11-12 sample. The
actual strays were `gap: 6`, `gap: 4`, `gap: 8`, `borderRadius: 6`,
`borderRadius: 4.5`, `borderRadius: 5`, `paddingVertical: 12`,
`paddingTop: 15`, `paddingHorizontal: 14` and `paddingVertical: 10`.
There was no `gap: 24` or `borderRadius: 36`.

Fifteen raw values moved onto existing tokens. Fully round shapes use
`radii.pill`. The 15pt top pad reads `taskRowFace.padY + 3`. Two drawn
glyph values stay literal with a reason in
`app/scripts/lint/layout-numbers.allowlist.ts`.

The guard is `app/scripts/lint/layout-numbers.test.ts`. It uses the
TypeScript AST, so computed values, variables and
`StyleSheet.hairlineWidth` are skipped. It fails a raw value at or above
4 with the file and line. It runs in the existing vitest job.

Visual proof is in `app/build/verify/evidence/design-scale/`, with 24
before and after pairs at 360 and 412 in Budget and Midnight. Capture
and Settings are pixel-identical. Lists and Planner differ only in the
Add button, which widens 2pt. Diagnostics buttons and the motion chip
grow 2pt per side.

Gates: `npx tsc --noEmit`, `npx eslint src scripts e2e
--max-warnings 0`, `npx vitest run` with 94 files and 829 tests, and
`E2E_PORT=8606 npm run e2e` with 444 passed and 26 skipped. PR 132.
