---
id: 0048
title: Keep the package token out of the repo
created: 2026-11-04
priority: high
assignee: opencode
pr: 85
depends: []
---

## Spec

The repo `.npmrc` held an `_authToken` line that named an environment
variable. When the variable is unset, npm sends the literal text, so a
token in the user config never applies.

CI also ran `npm ci` in the Android workflow with no package token.

Remove the token line from `.npmrc`.
Read the token from the user-level `~/.npmrc`.
Make every CI job write the `VALE_RULES_TOKEN` secret into the runner's
npm config.

## Acceptance

- [x] `.npmrc` names the registry and holds no token line
- [x] the docs and code jobs authenticate from `VALE_RULES_TOKEN`
- [x] the Android job authenticates from `VALE_RULES_TOKEN`

## Outcome

Pull request [#85](https://github.com/mzt-tang-athena/monkey-tasks/pull/85) carries the change.
