---
title: The gate matches the template
created: 2026-11-26
priority: normal
assignee: mstack
pr: 260
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

- [x] `make check-template` reports 0 differ.
- [x] A full gate still runs in the capped unit on the heavy lock.
- [x] A full gate still leaves the web suite to CI, and `--web` runs it.
- [x] `test-heavy.sh` still proves the lock queues.

## Outcome

`scripts/gate.sh` and `scripts/test-gate.sh` are the template's bytes.
The heavy lock lives in `scripts/gate-prelude.sh`, which a full gate
sources first. Against project-template#25, `make check-template` reports
0 differ. It reports 2 until that PR merges, so it merges first.

The ADR `20261126-ci-carries-the-web-suite` has a dated amendment.
