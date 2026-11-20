---
title: Heavy jobs start their own unit
created: 2026-11-20
priority: normal
assignee:
pr:
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

- [ ] A plain `web-suite.sh` run starts a capped unit and waits for it.
- [ ] `--background` returns the unit name and does not wait.
- [ ] A second heavy job waits for the first.
- [ ] A custom emulator script runs through the entry point.
- [ ] The skill's "Heavy jobs take turns" section shrinks to the commands.

## Outcome

(filled in before moving to done/)
