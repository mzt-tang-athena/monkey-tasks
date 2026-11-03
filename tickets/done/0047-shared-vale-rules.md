---
id: 0047
title: Use the shared Vale rules package
created: 2026-11-03
priority: normal
assignee: openchamber
pr: 78
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

- [x] `@mzt-tang-athena/vale-rules@0.1.0` is a dev dependency.
- [x] `.npmrc` names the GitHub Packages registry and reads `NODE_AUTH_TOKEN`.
- [x] The local `MyRules` copy and `Readability/LIX.yml` are gone.
- [x] `make lint` and the CI docs job run `npx vale-rules sync` before Vale.
- [x] The docs prose check reports 0 errors, before and after.
- [x] Repo checks pass.

## Outcome

Done. The repo uses `@mzt-tang-athena/vale-rules@0.1.0`.

The first CI run could not read the package: `GITHUB_TOKEN` belongs to
`monkey-tasks`, and the package is linked to `mzt-tang-athena/contracts`.
The docs job got 403 `read_package` and the code job got 401.

Both jobs now pass `secrets.VALE_RULES_TOKEN` as `NODE_AUTH_TOKEN`. That
is an organization secret with visibility all, which carries a personal
access token with `read:packages`. No per-repo package grant is needed.

The repo now installs `@mzt-tang-athena/vale-rules@0.1.0` from GitHub
Packages. The local `MyRules` files and `Readability/LIX.yml` are no
longer tracked. `make lint` and the CI docs job run `npx vale-rules sync`
before Vale. The `write-good` clone and the `.vale.ini` overrides stay.
ADR 0035 records the decision.

The same prose check on all tracked markdown gave 0 errors before and
after. The first run with the pack gave 12 warnings: 11 from
`SentenceLength` and 1 from `Antithesis`. Splitting the long sentences
brought the final count back to 0 errors and 0 warnings. `Plain` found
nothing.

`make lint`, a clean clone install and sync, `npm test` (27 tests), and
`npm run typecheck` all pass. PR 78.
