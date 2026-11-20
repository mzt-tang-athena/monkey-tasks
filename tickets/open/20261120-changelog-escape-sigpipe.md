---
title: Keep the no-changelog escape on a long branch
created: 2026-11-20
priority: high
assignee:
pr:
depends: []
---

## Spec

`scripts/check-changelog-entry.sh` runs `git log ... | grep -Fxq` under
`set -o pipefail`. On a branch with a long log, `grep -q` stops at the
first match and `git log` dies on SIGPIPE. The pipeline then reads as no
match, so a branch that says `Changelog: none` fails the check.

The template's `check-tickets.sh` had the same fault. project-template #22
fixes it there. That file is byte-copied into every repo, so the fix
reaches here through `make sync-template`. This file is this repo's own, so
it needs its own fix and test.

## Acceptance

- [ ] A 300 commit fixture with `Changelog: none` passes the checker
- [ ] The existing cases still pass
- [ ] `scripts/gate.sh full` passes on the branch

## Outcome

(filled in before moving to done/)
