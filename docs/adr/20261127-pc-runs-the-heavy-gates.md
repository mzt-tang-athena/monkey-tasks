# The PC runs the heavy gates

- **Status:** accepted
- **Date:** 2026-11-27

## Context

A full gate takes 29 to 41 minutes on the home server. One heavy job
runs at a time there. The operator's PC runs the same gate in about
135 seconds. Its WSL Ubuntu has the toolchain, the Android SDK, Vale and
a GitHub login. Tailscale names it `gorillapc`.

The gate itself is fine. The box is the slow part, and lanes queue on it.

## Decision

`scripts/pc-gate.sh <ref>` runs the full gate on the PC. It copies the
receipt back to `~/.local/state/local-gate/` under the same file name.
`pr-land` reads it unchanged.

- The ref must already be on origin. The script pushes nothing.
- It copies a small runner to the PC, runs it in WSL, then removes it.
- The runner fetches, checks out the commit, installs modules when a
  lockfile moved, builds the schemas and syncs Vale.
- The PC runs `scripts/gate.sh full --sha <sha>` and posts the
  `local-gate` status itself.
- `PC_HOST` names another host. It defaults to `gorillapc`.
- If the PC does not answer, the script says so and runs
  `scripts/gate.sh full --sha <sha>` here.
- That fallback needs the ref to be HEAD on a clean tree.

`scripts/gate.sh` stays the only gate definition. The wrapper stages,
runs and copies. It never lists a check.

## Consequences

A gate drops from about 35 minutes to about 3. It stops queueing on the
server's heavy lock.

The PC must be awake and on the tailnet. When it sleeps, the lane waits
for the slow local gate and loses the saving.

The PC holds an npm token and a GitHub login that can post statuses on
the repo. A person who owns the PC can forge a receipt. We accept that,
because the same person already owns the repo.

The PC keeps its own clone, modules and Vale styles. They drift from the
server's, and a lockfile stamp in each `node_modules` is the only
guard. A clean clone fixes it.

The web suite still rides CI. This does not change that decision.

## Alternatives we rejected

Run the gate in a Windows share of the server's checkout. It needs a
mount, and two hosts would write one tree.

Push receipts from the PC through a service. It needs an endpoint and a
token to guard. Copying one file back needs neither.

Send the PC a patch instead of a commit on origin. The receipt would
name a commit nobody else can check, and `pr-land` needs the PR head.

Pay for hosted runners. CI already runs for free here, and the PC is
already paid for.
