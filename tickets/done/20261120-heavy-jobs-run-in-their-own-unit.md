---
title: Heavy jobs start their own unit
created: 2026-11-20
priority: normal
assignee: omp
pr: 200
depends: []
---

## Spec

`web-suite.sh`, `android-build.sh` and `android-release-smoke.sh` in the
verify skill already take the heavy lock. A prelude re-runs each one
under `flock -o /tmp/monkey-tasks-heavy.lock`.

Every caller still types the rest by hand:

- `systemd-run --user --unit=<name> --collect -p MemoryMax=8G
  --setenv=HOME=$HOME --setenv=PATH=$PATH`, so a build that runs out of
  memory dies alone and does not take OpenChamber with it.
- A wait loop on `systemctl --user is-active`.
- For a custom emulator script, both locks in the right order: heavy
  first, then the emulator lock.

Extend the existing prelude, and add no new wrapper beside the scripts:

- Started from a shell, each script runs itself again in its own
  capped unit. It waits and prints the result.
  `--background` returns at once with the unit name.
- One entry point runs a caller's own emulator script under both locks,
  in order, in its own unit.

## Acceptance

- [x] A plain `web-suite.sh` run starts a capped unit and waits for it.
- [x] `--background` returns the unit name and does not wait.
- [x] A second heavy job waits for the first.
- [x] A custom emulator script runs through the entry point.
- [x] The skill's "Heavy jobs take turns" section shrinks to the commands.

## Outcome

Shipped in #200.

- Each heavy script starts its own 8G unit through one prelude,
  `scripts/heavy.sh`, waits for it and returns its exit code.
- `--background` returns the unit name at once.
- `heavy-emulator.sh <script>` runs any emulator script under both locks,
  heavy first, and leaves the emulator up through `KillMode=process`.
- The unit inherits the caller's environment and directory, so `CLEAN`,
  `ARCHS`, `MONKEY_LOG_DIR` and `ANDROID_VERIFY_PORT` reach the job.
- Proof: a plain `web-suite.sh` printed
  `unit heavy-web-suite-20261120-084437-7978 (MemoryMax=8G)`, waited
  21m46s, and returned exit 0 with 669 passed.
- `--background` returned in 0.059 s with the name. The unit read
  `ActiveState=active` and `MemoryMax=8589934592`.
- A second job started its body only after the first ended.
- The emulator entry held the heavy lock while it queued on the
  emulator lock, then held both. Its child survived the unit.
- `MONKEY_HEAVY_LOCK=1` still runs in place, and a nested heavy job does
  not deadlock.
- Amendment 2026-11-20 in ADR `20261118-fast-android-proof` records the
  environment and kill-mode choices.
- `scripts/gate.sh full` passed at the code head in 1378 s. This close
  commit is prose, so it gets `fast`.
