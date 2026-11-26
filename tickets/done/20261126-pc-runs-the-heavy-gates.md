---
title: A repo script runs the gate on the PC
created: 2026-11-26
priority: normal
assignee: omp
pr: 249
depends: [20261126-host-runs-one-heavy-job]
---

## Spec

The operator's PC (Tailscale `gorillapc`, WSL Ubuntu) now gates
faster than athena. On 2026-11-26 a full gate took 136 s there,
against 29 to 41 min here. Its WSL has the toolchain, the Android
SDK, Vale, the npm login and the GitHub login.

Make it a lane's real option with a repo script:

- `scripts/pc-gate.sh <ref>` pushes nothing itself. It requires the
  ref on origin. On the PC it fetches and checks out, then runs
  `npm ci` in `contracts` and `app` when a lockfile moved. It updates
  the submodule, builds the schemas dist, syncs Vale, and runs
  `scripts/gate.sh full`.
- The receipt comes back to athena's
  `~/.local/state/local-gate/`, so `pr-land` accepts it as usual.
- The PC posts the GitHub status itself, as it did in the proof run.
- `PC_HOST` defaults to `gorillapc`. A missing host or a failed ssh
  falls back to running locally, and says so.
- `scripts/gate.sh` stays the local path. `pc-gate.sh` is a thin
  wrapper, so the repo keeps one gate definition.
- Record the trade-off in an ADR. The PC must be awake. A token and
  a GitHub login live there. Athena stays the fallback.

## Acceptance

- [x] `pc-gate.sh <pushed ref>` writes a passing receipt on athena.
- [x] `pr-land` accepts a PC receipt for a PR head.
- [x] A refused ssh falls back to the local gate, with a line.
- [x] The ADR records the PC runner and its fallback.

## Outcome

`scripts/pc-gate.sh <ref>` runs the full gate on the PC in about 3
minutes. It copies the receipt back under the same name, so `pr-land`
reads it. The PC posts the status. A host that does not answer runs the
local gate, with a line. ADR `20261127-pc-runs-the-heavy-gates` records
the PC runner and its fallback.

Next: lanes call `scripts/pc-gate.sh` for their final gate.
