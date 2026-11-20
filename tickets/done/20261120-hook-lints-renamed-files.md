---
title: The hook lints a renamed file
created: 2026-11-20
priority: normal
assignee: omp
pr: 192
depends: []
---

## Spec

The pre-commit hook leaves out a file that the same commit renames.
`.githooks/pre-commit:11` lists the staged files with
`--diff-filter=ACM`. A rename stands for `R`, so the list drops it and
no check sees that file.

Every ticket close takes that shape. The commit moves the ticket from
`doing/` to `done/` and writes the Outcome, so its prose waits for the
gate. On 2026-11-20 a long sentence in a closed ticket passed the hook
and failed `scripts/gate.sh fast`.

The one list feeds all three checks in the hook. ESLint on app code,
Vale on docs, and the changelog bullet check all read it. A renamed
code file slips past the linter in the same way.

Add `R` to the filter, and a script that stages a rename to keep it.

## Acceptance

- [x] the hook lints a renamed doc and a renamed code file
- [x] a clean rename and a deleted file still pass
- [x] `scripts/test-pre-commit.sh` fails against the old hook
- [x] `scripts/test-pre-commit.sh` passes against the new hook
- [x] `make test-pre-commit` runs it
- [x] `scripts/gate.sh fast` passes on this branch

## Outcome

Shipped in #192.

- `.githooks/pre-commit` lists the staged files with `ACMR`. A rename
  now keeps its new name in the list that ESLint, Vale and the
  changelog check read.
- `scripts/test-pre-commit.sh` holds six cases and 10 assertions. A
  renamed ticket with a long sentence fails the hook.
- Other cases cover a clean rename, a space in the name and a renamed
  app file.
- Two more cover an added ticket and a deleted one.
- Against the old hook the test fails at the first case, with `the hook
  let the commit through`.
- The test joins `make ci` and the docs job in CI. `make
  test-pre-commit` runs it by hand.
- The close took two commits. The Outcome edit landed while the ticket
  sat in `doing/`, which the hook reads as `M`. A pure rename followed,
  and the hook printed `vale: 1 file(s)` for it. The old filter saw
  nothing in that commit.

Nothing runs next. The gate still lints every changed doc, so a lane
that skips the hook stays covered.
