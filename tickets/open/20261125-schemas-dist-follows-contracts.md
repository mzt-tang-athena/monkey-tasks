---
title: The schemas build follows the contracts checkout
created: 2026-11-25
priority: normal
assignee:
pr:
depends: []
---

## Spec

`scripts/worktree-setup.sh` builds the schemas only when
`contracts/packages/schemas/dist` is missing. A merge that moves the
`contracts` submodule leaves the old build in place. Then tsc fails on
stale types until someone rebuilds by hand. Main hit this on
2026-11-25 after #224, and so did the Inbox lane.

A lane worktree can also move main's `contracts` checkout. Then main's
gate or a release runs on the wrong schemas.

- Rebuild the dist when the `contracts` commit differs from the one
  setup built the dist from. A stamp file in `dist` is one way.
- Make `scripts/gate.sh` and `scripts/release.sh` refuse to run when
  `git submodule status` shows a `+` for `contracts`. Name the fix.

## Acceptance

- [ ] After a `contracts` bump, setup rebuilds the dist by itself.
- [ ] An unchanged `contracts` skips the build.
- [ ] The gate stops on a drifted `contracts` and names the fix.
- [ ] The release stops on a drifted `contracts` too.

## Outcome

(filled in before moving to done/)
