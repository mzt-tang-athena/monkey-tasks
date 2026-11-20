---
title: The hook lints a renamed file
created: 2026-11-20
priority: normal
assignee: omp
pr:
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

- [ ] the hook lints a renamed doc and a renamed code file
- [ ] a clean rename and a deleted file still pass
- [ ] `scripts/test-pre-commit.sh` fails against the old hook
- [ ] `scripts/test-pre-commit.sh` passes against the new hook
- [ ] `make test-pre-commit` runs it
- [ ] `scripts/gate.sh fast` passes on this branch

## Outcome
(filled in before moving to done/)
