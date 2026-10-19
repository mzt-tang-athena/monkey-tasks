# 0007. Central contracts repo for home-server schemas

- **Status:** accepted
- **Date:** 2026-10-19

## Context

The notes vocabulary started as `packages/schemas` inside monkey-tasks
(ADR 0005). The plan grew beyond one project: every home-server project
(monkey-tasks, monkey budget, athena services) wants one shared home
for schemas, where a project contributes its own and consumes shared
ones. Multiple repos will read the notes vocabulary.

## Decision

A standalone repo, `mzt-tang-athena/contracts`, holds all home-server
schemas, one package per domain under `packages/`. Consumers depend on
a package through a git submodule plus a `file:` dependency. No
registry service runs. The first package is the notes vocabulary,
moved out of monkey-tasks.

## Consequences

A schema change is a PR in contracts, then consumers update the
submodule. There is one more repo to maintain. The vocabulary stays
hand-written Zod (ADR 0005); only its home changed. Moving to a
registry later (GitHub Packages) changes only the install path, never
the schemas.
