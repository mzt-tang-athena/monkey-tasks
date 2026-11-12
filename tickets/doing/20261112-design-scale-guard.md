---
title: Name the spacing and radius scale, and guard it
created: 2026-11-12
priority: normal
assignee: omp
pr:
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

- [ ] Every raw layout value at or above 4 in features and components is
      a token or an allowlisted exception with a reason.
- [ ] The test fails when a new raw value is added.
- [ ] The token comments separate layout steps from marks.
- [ ] Screenshots of the affected screens before and after.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e --max-warnings 0`,
      `npx vitest run` and the e2e pass.
- [ ] No new CI job.

## Outcome

(filled in before moving to done/)
