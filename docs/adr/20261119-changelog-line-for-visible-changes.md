# A changelog line for a visible change

- **Status:** accepted
- **Date:** 2026-11-19

## Context

`CHANGELOG.md` becomes the release notes. Five of thirteen user-facing
PRs in 1.2 shipped without a bullet, because nothing checked. A lane
remembered the rule or it did not.

The repo also takes changes that a user never sees: refactors,
dependency bumps and test fixes, all under `app/`. A rule of "any
change under `app/`" would demand a release note for each.

## Decision

`scripts/check-changelog-entry.sh` fails a branch when two things are
true. The branch changed user-visible app code, and it did not change
`CHANGELOG.md`.

User-visible means:

- Any path under `app/src/`, except tests, `app/src/testing/` and the
  sample vault in `app/src/lib/vault/sample/`.
- Any path under `app/assets/`.
- `app/app.json`, which holds the app name and the icon paths.

One escape exists. A commit since the merge base whose body has the
trailer line `Changelog: none` tells the checker to pass. A lane writes
the trailer when a visible change deserves no release note. A refactor
behind the same screen is one example.

`scripts/gate.sh` runs the check in both modes. The docs-only and the
tooling-only PRs pass with no bullet.

We rejected a label or a PR checkbox. Neither leaves a record in the
branch, and a local gate cannot read a label. We also rejected "any
change under `app/`". It costs a bullet on every internal change, and
lanes would learn to add empty ones.

## Consequences

A lane adds the bullet or writes the trailer, and the gate says which
one it expects. The trailer stays in the history, so a later reader can
see why a visible change has no note.

The rule runs in the local gate only, not in CI. A PR that skips the
gate can still ship without a bullet. CI would need the base ref and
its history, and the gate is the path every lane takes.

The path list needs care when the app gains a new visible folder. A
change under a missing path passes the check with no note. We accept
that over a list that guesses. A miss costs a line in the release
notes. A false fail costs every lane.
