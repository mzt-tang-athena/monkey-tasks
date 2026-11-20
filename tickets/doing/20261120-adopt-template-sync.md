---
title: Adopt the shared template files and the Vale package
created: 2026-11-20
priority: normal
assignee: omp
pr:
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

- [ ] `make sync-template` reports 0 differ and 0 missing
- [ ] `make lint` runs the template checks plus this repo's own
- [ ] `ensure-styles` and `WRITE_GOOD_SHA` leave the `Makefile`
- [ ] CI fetches write-good with `scripts/sync-vale-packages.sh`
- [ ] `make ci` passes

## Outcome
