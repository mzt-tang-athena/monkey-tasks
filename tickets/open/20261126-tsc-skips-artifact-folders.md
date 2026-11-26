---
title: Typecheck skips build and test artifacts
created: 2026-11-26
priority: normal
assignee:
pr:
depends: []
---

## Spec

`tsc` has no `include`, so it compiles every `.ts` file under `app/`,
including untracked artifacts in `app/build/verify/evidence/` and
`app/e2e/test-results/`. Two lanes ran the gate out of memory
that way on 2026-11-26. Each found the cause by hand.

- Give the typecheck an explicit `include`, or exclude the artifact
  folders, whichever fits the tsconfig's shape.
- The gate must typecheck the same files on a dirty worktree as on a
  clean one.
- The fix proves itself: a worktree with those folders full passes
  the typecheck.

## Acceptance

- [ ] A worktree holding artifact folders still typechecks.
- [ ] The gate's memory use no longer doubles on a dirty tree.

## Outcome

(filled in before moving to done/)
