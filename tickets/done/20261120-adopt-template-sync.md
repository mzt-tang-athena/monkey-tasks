---
title: Adopt the shared template files and the Vale package
created: 2026-11-20
priority: normal
assignee: omp
pr: 199
depends: []
---

## Spec

The repo keeps copies of `gate.sh`, `check-records.sh` and the rest.
They fell behind project-template, with nothing to flag the drift.
project-template #21 added `scripts/template-files.txt`,
`scripts/sync-template.sh` and `template.mk`.

project-template #20 moved write-good to a Vale package pinned in
`.vale.ini`, fetched by `scripts/sync-vale-packages.sh`. This repo
still clones write-good by commit in the `Makefile` and in CI.

Take the shared files, add `include template.mk`, delete the recipes
it owns, and call the shared Vale script instead of the clone.

## Acceptance

- [x] `make sync-template` reports 0 differ and 0 missing
- [x] `make lint` runs the template checks plus this repo's own
- [x] `ensure-styles` and `WRITE_GOOD_SHA` leave the `Makefile`
- [x] CI fetches write-good with `scripts/sync-vale-packages.sh`
- [x] `make ci` passes

## Outcome

Took the 13 shared files at project-template `05ff1ec`, added
`include template.mk`, and kept this repo's own targets, worktree setup
and test scripts. The `Makefile` lost `check-records`,
`test-check-records`, `ensure-styles` and `WRITE_GOOD_SHA`.
`scripts/worktree-setup.sh` calls `scripts/sync-vale-packages.sh` where
it called `make ensure-styles`.

Next: the other repos follow, and project-template still owns the
shared-file list.

