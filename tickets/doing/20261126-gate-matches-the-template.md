---
title: The gate matches the template
created: 2026-11-26
priority: normal
assignee: mstack
pr:
depends: []
---

## Spec

monkey-tasks changed `scripts/gate.sh` and `scripts/test-gate.sh` in #245
and #249 without the template. Every gate prints
`template: differs` for both files, and `make sync-template` would undo
the heavy lock and the web skip.

project-template#25 takes the generic parts: the web skip, `--web`, the
receipt's `web` field, and a repo `scripts/gate-prelude.sh` hook. This
repo syncs from it and keeps the heavy lock in the hook.

## Acceptance

- [ ] `make check-template` reports 0 differ.
- [ ] A full gate still runs in the capped unit on the heavy lock.
- [ ] A full gate still leaves the web suite to CI, and `--web` runs it.
- [ ] `test-heavy.sh` still proves the lock queues.

## Outcome

(filled in before moving to done/)
