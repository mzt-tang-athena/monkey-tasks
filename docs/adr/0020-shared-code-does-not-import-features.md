# 0020. Shared code does not import features

- **Status:** accepted
- **Date:** 2026-10-22

## Context

`lib/mock.ts` imported a type from `features/tasks/query`. One import is
harmless on its own, but the direction is wrong: shared code that leans
on a feature cannot be reused by another feature, and the cycle becomes
likely as the app grows.

## Decision

`app/src/lib` holds code with no knowledge of features or routes. A
feature may import from `lib`. `lib` may not import from `features` or
`app`, except for types, which the compiler erases.

The rule is enforced in `app/eslint.config.js` with
`@typescript-eslint/no-restricted-imports` and `allowTypeImports`. A
type-only import is allowed because it leaves no runtime edge.

## Consequences

Shared helpers have to be extracted rather than reached for across
folders. The check fails a build, so the rule does not depend on review
attention.

## Alternatives

**Leave it to review.** The codebase already had the wrong edge and
nothing caught it.

**Move every shared type into `lib`.** It would duplicate the task model
that the schema package already owns.
