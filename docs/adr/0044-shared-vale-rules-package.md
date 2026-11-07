# 0044. Shared Vale rules package

- **Status:** accepted
- **Date:** 2026-11-03

## Context

The prose rules lived in `.vale/styles/MyRules/` as a copy. The same
rules now live in the package `@mzt-tang-athena/vale-rules` on GitHub
Packages. Two copies drift apart. A rule fix in one repo leaves the
others behind.

## Decision

We install `@mzt-tang-athena/vale-rules` as a dev dependency. We run
`npx vale-rules sync` before Vale in `make lint` and in the CI docs job.
The pack owns the rule files. We keep the `write-good` clone and the
repo-specific `.vale.ini` overrides.

The pack adds `Antithesis`, `Plain`, and `SentenceLength`. Those rules
found long sentences in the docs. We split the sentences, so the docs
pass the same warning threshold as before.

## Consequences

One source feeds the prose rules for every repo. A rule change reaches
this repo through a package update and a sync. The CI docs job now
needs a `GITHUB_TOKEN` with `read:packages` to install the package. A
fresh clone must run `npm ci` and `npx vale-rules sync` before Vale.

## Amendment, 2026-11-07

This ADR was 0035 on main. The epic branch already had an ADR 0035, so
this one took 0044 when main merged into the epic (ticket 0071).
