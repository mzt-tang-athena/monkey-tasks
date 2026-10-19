---
id: 0007
title: Extract schemas to the central contracts repo
created: 2026-10-19
priority: high
assignee: opencode
pr: 3
depends: []
---

## Spec

Create `mzt-tang-athena/contracts` (private). Move `packages/schemas`
from monkey-tasks into `contracts/packages/schemas` unchanged: the
package name `@monkey-tasks/schemas`, the Zod models, `VOCABULARY.md`,
and the tests, including the live-vault sweep. Consumers depend on the
package through a git submodule plus a `file:` dependency (ADR 0007).

In monkey-tasks: add `contracts` as a git submodule at `contracts/`,
replace the workspace package with the `file:` dependency, and keep
tests and typecheck green. Tag the contracts commit `v0.1.0` and pin
the submodule to it.

## Acceptance

- [x] the contracts repo exists with `packages/schemas` and tag `v0.1.0`
- [x] monkey-tasks installs the package through the submodule and
      `file:` dependency
- [x] `npm test` passes in both repos, including the vault sweep
- [x] README and ADRs reference the new home

## Outcome

Done, PR 3. `mzt-tang-athena/contracts` exists (private) with
`packages/schemas` moved unchanged, tagged `v0.1.0`, and pinned as the
submodule in monkey-tasks at `contracts/`. The root workspaces wrapper
was replaced by a `file:` dependency. All 21 tests pass in both repos,
including the live-vault sweep running from the new home. ADR 0007
records the decision; ADR 0005 carries the amendment. The package name
stays `@monkey-tasks/schemas` for now; renaming to domain-wide names
(`@monkey/notes`) can happen when the second package arrives.
