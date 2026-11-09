---
id: 0077
title: Consume the schemas package and drop the contracts submodule
created: 2026-11-09
priority: normal
assignee:
pr:
depends: []
---

## Spec

`app/package.json` reads `@monkey-tasks/schemas` from the contracts
submodule by file path. That carries three costs.

1. The app compiles TypeScript source out of a dependency, so
   `app/metro.config.js` keeps a custom resolver and a watch folder.
2. A schema change needs a manual submodule bump.
3. The pin is a raw commit, so nothing reports a stale consumer. The
   app once sat four commits behind and kept the old parser.

The registry path already works here. Ticket 0047 moves the Vale rules
to `@mzt-tang-athena/vale-rules` from the same registry. The repo has
`.npmrc` with the `@mzt-tang-athena` scope, and both CI jobs
authenticate with `NODE_AUTH_TOKEN`.

The schemas package is published as
`@mzt-tang-athena/schemas@0.2.1`. It builds to `dist` and declares an
`exports` map. Metro 0.87 reads `exports`.

## Work

- `app/package.json`: depend on `@mzt-tang-athena/schemas@^0.2.1`.
- The 24 import sites in `app/src`: change the scope only, nothing
  else.
- `app/metro.config.js`: remove the resolver override, `watchFolders`,
  and the `contracts/node_modules` path.
- Root `package.json`: remove the `@monkey-tasks/schemas` dependency
  and the `test` and `typecheck` scripts that `cd` into `contracts/`.
  Contracts CI owns those checks now.
- `.github/workflows/ci.yml`: remove the submodule checkout step and
  the `CONTRACTS_TOKEN` reference.
- `git submodule deinit -f contracts`, `git rm contracts`, delete
  `.gitmodules`.
- `README.md`: remove the submodule instructions.
- ADR 0007: add a dated amendment at the bottom. Do not rewrite the
  original decision.

Land the dependency and the import swap first. Then remove the
submodule. Each commit must end in a state that builds.

Do not rename the package again. The scope names the org because
GitHub Packages requires it.

## Acceptance

- [ ] `npm ci` at the root and in `app` needs no submodule
- [ ] no TypeScript import names `@monkey-tasks/schemas`
- [ ] `npx tsc --noEmit` passes in `app`
- [ ] `npx vitest run` passes in `app`
- [ ] `npx expo export --platform android` completes
- [ ] `ci.yml` has no `CONTRACTS_TOKEN` and no submodule step
- [ ] `contracts/` and `.gitmodules` are gone

## Outcome

(filled in before moving to done/)
