---
id: 0029
title: Checks that run before a commit
created: 2026-10-23
priority: normal
assignee: omp
pr: 31
depends: []
---

## Spec

The repo had no local checks and CI never ran ESLint. A broken hook rule
or a passive sentence reached CI, and the feedback arrived minutes later.

Add a pre-commit hook and close the CI gap.

- `.githooks/pre-commit` runs ESLint on the staged app code and Vale on
  the staged docs. Only staged files, so a commit stays fast.
- `make hooks` points `core.hooksPath` at the folder. It is per clone,
  not committed state, because hooks are not cloned by default.
- CI runs `npx eslint src`, which it never did.
- CI lints every tracked markdown file, not just the README and the ADR
  folder, and fails on warnings. Vale exits zero on warnings, so the
  step checks the output.

## Acceptance

- [ ] A staged TypeScript file with a hook-rule error blocks the commit.
- [ ] A staged markdown file with passive voice blocks the commit.
- [ ] A clean commit passes in under five seconds.
- [ ] CI fails when ESLint reports an error.
- [ ] CI fails when any tracked markdown file has a prose warning.
- [ ] The README says how to install the hook.

## Outcome

`.githooks/pre-commit` runs ESLint on staged app code and Vale on staged
docs. `make hooks` installs it per clone. CI runs ESLint for the first
time and lints every tracked markdown file, failing on warnings.

Verified: the hook blocked a staged passive sentence and a clean commit
passed in 2.9 seconds. The first CI run of the new prose gate caught one
warning in AGENTS.md, which is fixed.

The ESLint gate blocks on errors only. The config leaves warnings such
as `import/first` in test files, and they do not fail CI.
