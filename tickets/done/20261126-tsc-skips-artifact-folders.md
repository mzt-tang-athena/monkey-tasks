---
title: Typecheck skips build and test artifacts
created: 2026-11-26
priority: normal
assignee: claude
pr: 256
depends: []
---

## Spec

`tsc` has no `include`, so it compiles every `.ts` file under `app/`,
including untracked artifacts in `app/build/verify/evidence/` and
`app/e2e/test-results/`. Two lanes hit an out-of-memory typecheck that
way on 2026-11-26. The tab-strip lane's gate log records one. Each
found the cause by hand.

- Give the typecheck an explicit `include`, or exclude the artifact
  folders, whichever fits the tsconfig's shape.
- The gate must typecheck the same files on a dirty worktree as on a
  clean one.
- The fix proves itself: a worktree with those folders full passes
  the typecheck.

## Acceptance

- [x] A worktree holding artifact folders still typechecks.
- [x] The typecheck reports no file from `app/build/` or
      `app/e2e/test-results/`.

## Outcome

`app/tsconfig.json` now lists the folders it checks. It leaves out
`e2e/test-results`. An include list beats an exclude list, because a
new artifact folder cannot sneak in. A stray `.ts` file in each
artifact folder is not listed, and `tsc` exits 0.
