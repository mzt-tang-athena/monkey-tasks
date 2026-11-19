---
title: One-command worktree setup and local gate
created: 2026-11-19
priority: normal
assignee: opencode
pr:
depends: []
---

## Spec

Every newer repo from `project-template` has `scripts/worktree-setup.sh`
and `scripts/gate.sh`. monkey-tasks does not, so each lane retypes the
setup recipe and the gate list from a scratch brief. Five of thirteen
user-facing 1.2 PRs shipped without a changelog line, because nothing
checked.

Add both scripts.

- `scripts/worktree-setup.sh` links `node_modules` from the main
  checkout, inits `contracts`, builds the schemas, syncs the Vale
  rules, sets the hooks path and picks a `VERIFY_PORT`.
- `scripts/gate.sh` writes the local-gate receipt. Full runs tsc,
  eslint, vitest, Vale on changed docs, the record and changelog
  checks, then the web suite. Fast skips the suite.
- `scripts/check-changelog-entry.sh` fails a branch that changes
  user-visible app code without a `CHANGELOG.md` change. A commit
  trailer `Changelog: none` is the escape.

The verify skill points lanes at the two scripts, and `AGENTS.md`
names them.

## Acceptance

- [ ] `scripts/worktree-setup.sh` sets up a fresh linked worktree
- [ ] `scripts/gate.sh full` leaves a passing receipt for the head
- [ ] the gate picks fast for a prose-only diff
- [ ] the changelog check fails without a bullet, and passes with one
      or with `Changelog: none`
- [ ] an ADR records what counts as user-visible
- [ ] `AGENTS.md` names both scripts

## Outcome

(filled in before moving to done/)
