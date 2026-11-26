---
title: The host runs one heavy job at a time
created: 2026-11-26
priority: high
assignee: heavy-host lane
pr: 245
depends: []
---

## Spec

This host has 4 cores and 15 GB. On 2026-11-26 the load average was
20. Swap was 3.4 of 4 GB and the box was still paging. Three jobs ran
together. A Gradle build held 4.2 GB of Java. An emulator held 2.8 GB
of qemu. A node process held 1.5 GB. A full gate took 29 to 41
minutes.

The heavy lock already covers the web suite and the Android builds.
Three costs escape it:

- An emulator outlives the unit that started it (`--keep-child`).
  qemu then holds about 3 GB and a core until a lane cleans up.
- A full gate runs tsc, eslint and vitest with no lock. It runs
  beside another lane's build.
- A clean Android build ignores `ARCHS`, so a lane's `CLEAN=1` rebuild
  compiles all four CPU types.

The operator picked three fixes. One heavy job at a time. Lane builds
for the emulator's CPU type only. One full gate per PR. The web suite
moves to CI, which is free for this public repo.

## Acceptance

- [x] A running emulator counts as heavy for as long as it runs, or
      stops when its journey ends.
- [x] A full gate holds the heavy lock for its whole run.
- [x] `CLEAN=1 android-build.sh` defaults `ARCHS` to `x86_64`.
      Only `scripts/release.sh` builds all four.
- [x] `scripts/gate.sh full` skips the web suite when CI runs e2e-web
      for the repo. `scripts/gate.sh full --web` still runs it.
- [x] The merge bar is the local gate receipt plus CI's e2e-web green
      on the same head. `AGENTS.md`, the README and the verify skill
      say so.
- [x] An ADR records the move to CI, its alternatives and its cost.
- [x] `test-heavy.sh` still passes.

## Outcome

Landed in one PR. The emulator now stops itself after 300 s of no use,
and every android script stamps use when it sources `android-env.sh`. A
full gate runs in one capped heavy unit. It leaves the web suite to CI,
which is free on this public repo. `CLEAN=1` builds pass
`ARCHS=x86_64` unless told otherwise, and only `scripts/release.sh`
builds all four types. ADR `20261126-ci-carries-the-web-suite` records
the move and what it costs.
