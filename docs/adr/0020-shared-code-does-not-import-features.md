# 0020. Shared code does not import features

- **Status:** accepted
- **Date:** 2026-10-22

## Context

`lib/mock.ts` imported a type from `features/tasks/query`. One import is
harmless on its own, but the direction is wrong. Another feature cannot
reuse shared code that leans on a feature. The cycle also becomes
likely as the app grows.

## Decision

`app/src/lib` holds code with no knowledge of features or routes. A
feature may import from `lib`. `lib` may not import from `features` or
`app`, except for types, which the compiler erases.

`app/eslint.config.js` enforces the rule with
`@typescript-eslint/no-restricted-imports` and `allowTypeImports`. The
rule allows a type-only import because it leaves no runtime edge.

## Consequences

We have to extract shared helpers rather than reach for them across
folders. The check fails a build, so the rule does not depend on review
attention.

## Alternatives

**Leave it to review.** The codebase already had the wrong edge and
nothing caught it.

**Move every shared type into `lib`.** It would duplicate the task model
that the schema package already owns.

## Amendment: 2026-10-26

ADR 0039 replaces the rule in this ADR. The check now covers every
layer, not only `lib`. Type-only imports no longer pass. The audit on
2026-10-26 found 66 imports that broke the layering. Of those, 35
carried types only, so the exemption hid half the problem.

The shared row types move to `src/types`. They import the frontmatter
types from `@monkey-tasks/schemas` and copy nothing from them, so the
schema package still owns the task model. Ticket 0050 removes the
`no-restricted-imports` block from `app/eslint.config.js`.
