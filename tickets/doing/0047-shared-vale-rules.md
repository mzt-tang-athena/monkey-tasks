---
id: 0047
title: Use the shared Vale rules package
created: 2026-11-03
priority: normal
assignee: openchamber
pr:
depends: []
---

## Spec

The prose rules live in two places: this repo keeps a copy under
`.vale/styles/MyRules/` and the shared package
`@mzt-tang-athena/vale-rules` holds the same rules. The copy drifts.
Swap it for the package so one source feeds every repo.

Add the package from GitHub Packages as a dev dependency, with a
committed `.npmrc` that reads the token from `NODE_AUTH_TOKEN`. Run
`npx vale-rules sync` before Vale in `make lint` and in the CI docs job.
Keep the `write-good` clone step, because the pack does not ship it.

The pack adds `Antithesis`, `Plain`, and `SentenceLength`, so warnings
may rise. Errors must stay at zero. Keep the repo-specific `.vale.ini`
overrides: the pack owns the rule files, not the config.

## Acceptance

- [ ] `@mzt-tang-athena/vale-rules@0.1.0` is a dev dependency.
- [ ] `.npmrc` names the GitHub Packages registry and reads `NODE_AUTH_TOKEN`.
- [ ] The local `MyRules` copy and `Readability/LIX.yml` are gone.
- [ ] `make lint` and the CI docs job run `npx vale-rules sync` before Vale.
- [ ] The docs prose check reports 0 errors, before and after.
- [ ] Repo checks pass.

## Outcome

(open)
