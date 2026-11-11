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

Amendment 2026-10-19: the repo was first created by hand, missing the
org project template. It was retrofitted with the template the same
day (agent rules, ADR record, ticket queue, docs CI), and the CI runs
green. Contracts records its own decisions from now on; its ADR 0001
mirrors this one.

Amendment 2026-11-11: contracts main now publishes the schemas as a
built package (`@mzt-tang-athena/schemas`, `main` is `dist/index.js`).
monkey-tasks still pins the submodule, because ticket 0077 owns the
move to the registry. The app now builds the pinned package into `dist`
from its `postinstall` script, so a fresh `npm ci` resolves the package
the same way a registry install would. We rejected moving the app to
the registry here, because 0077 owns that change. We rejected pinning
an older contracts commit, because the kind change lives on main. 0077
deletes the build step along with the submodule.
