---
title: One-command worktree setup and local gate
created: 2026-11-19
priority: normal
assignee: opencode
pr: 186
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

- [x] `scripts/worktree-setup.sh` sets up a fresh linked worktree
- [x] `scripts/gate.sh full` leaves a passing receipt for the head
- [x] the gate picks fast for a prose-only diff
- [x] the changelog check fails without a bullet, and passes with one
      or with `Changelog: none`
- [x] an ADR records what counts as user-visible
- [x] `AGENTS.md` names both scripts

## Outcome

Shipped in #186.

- `scripts/worktree-setup.sh` set up this lane in 6.7 s. A second run
  changed nothing.
- `scripts/gate.sh fast` passed in 2 s. A scratch clone with a docs
  change picked fast with no mode.
- `scripts/gate.sh full` passed on the final head. The receipt and
  the per-step times are in the PR.
- `scripts/gate.sh` is the project-template file, byte for byte. The
  repo's steps live in the `lint` and `ci` Makefile targets.
- `scripts/test-check-changelog-entry.sh` covers six cases, both ways.
- ADR `20261119-changelog-line-for-visible-changes` records the rule.

The changelog check runs in the local gate only. CI still runs
`check-changelog.sh` alone.
