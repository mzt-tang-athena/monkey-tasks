# CI carries the web suite

- **Status:** accepted
- **Date:** 2026-11-26

## Context

The host runs one heavy job at a time on `/tmp/monkey-tasks-heavy.lock`.
A full gate ran its tsc, eslint, vitest and the web suite beside a
lane's build, uncapped. tsc took 68 s and 922 MB. eslint took 140 s and
2.2 GB. vitest took 258 s and 597 MB. The box was already at 11.7 GB
used.

The web suite was the longest step. It also repeats work CI already
does: the `ci` workflow runs e2e-web on every PR. This repo is public,
so those runner minutes cost nothing.

## Decision

The gate leaves the web suite to CI. `scripts/gate.sh full` runs in one
capped 8 GB unit on the heavy lock, and `make ci` no longer names
`web-suite`. The merge bar is the local receipt plus CI's e2e-web green
on the same head.

The gate runs the suite here when it cannot count on CI. That means no
e2e-web job, no GitHub slug, a private repo, or a `gh` that cannot
answer. `scripts/gate.sh full --web` forces it. A receipt that ran the
suite outranks a plain one on the same tree.

## Consequences

One heavy job runs at a time, so a gate and a build take turns instead
of thrashing the box. A full gate drops from about 20 minutes to 8.

The bar now needs network and two checks, not one. CI's e2e-web takes
about 11 minutes on a PR, so a merge waits on it. A CI outage stops the
bar, and `--web` is the way through.

We keep the suite runnable here. The web build can still break in a way
CI reports. The PR is open by then, and the fix lands in a second push.

## Alternatives we rejected

Run everything locally. This is where we were. It keeps the box at its
memory cap for the whole gate and delays every other lane.

Move the web suite to a second machine with WSL. That adds a host to
patch, a share for the checkout, and a second emulator to keep in
step. It buys the same coverage CI gives for free.

Pay for faster runners: Blacksmith, BuildJet or Namespace. e2e-web is
11 minutes on free minutes. A paid runner saves a few minutes a PR and
costs a subscription and a second CI vendor to configure.

## Amendment, 2026-11-26: the template owns the gate

The gate changes above first lived only in this repo's copy of
`scripts/gate.sh`. Every gate printed `template: differs`, and a
`make sync-template` would have undone them.

The template now carries the web skip, `--web` and the receipt's `web`
field (project-template ADR `20261126-gate-web-skip-and-prelude`). The
heavy lock moved into `scripts/gate-prelude.sh`, which a full gate
sources first. That file is repo owned, so the template names no path
that only this repo has. The gate behaves as before.
