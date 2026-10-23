# 0026. Checks that run before a commit

- **Status:** accepted
- **Date:** 2026-10-23

## Context

The repo had no local checks. CI ran the typecheck, the tests, the
schemas tests and the bundle, and it ran Vale on the README, the ADRs
and the ticket format. It did not run ESLint, and the prose check never
failed: Vale exits zero on warnings, so passive voice passed.

Feedback arrived minutes after a push, in a job the author had to open.

## Decision

A pre-commit hook runs the fast checks on staged files: ESLint for app
code, Vale for markdown. The hook lives in `.githooks/` and `make hooks`
points `core.hooksPath` at it.

CI gets the same gates. ESLint runs in the code job. The prose step
lints every tracked markdown file and fails on warnings, because Vale's
exit code ignores them.

## Consequences

A broken hook rule or a passive sentence stops at the commit instead of
in CI. The hook skips work when nothing relevant is staged, so a docs
commit does not run ESLint.

Hooks are not cloned, so each clone runs `make hooks` once. A commit
made with `--no-verify` skips the hook; CI still checks it.

The prose gate covers ticket files now, which is where most of the
writing happens.

## Alternatives

**Husky and lint-staged.** They add dependencies and a second
configuration format for the same two commands.

**Run the typecheck and the tests in the hook.** Both take long enough
that authors would reach for `--no-verify`. They stay in CI.
