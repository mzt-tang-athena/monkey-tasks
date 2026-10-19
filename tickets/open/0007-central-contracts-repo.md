---
id: 0007
title: Extract schemas to the central contracts repo
created: 2026-10-19
priority: high
assignee:
pr:
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

- [ ] the contracts repo exists with `packages/schemas` and tag `v0.1.0`
- [ ] monkey-tasks installs the package through the submodule and
      `file:` dependency
- [ ] `npm test` passes in both repos, including the vault sweep
- [ ] README and ADRs reference the new home
