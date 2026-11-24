---
title: Heavy jobs keep the caller's secrets off argv
created: 2026-11-24
priority: high
assignee: opencode
pr: 219
depends: []
---

## Spec

`heavy.sh` forwards every exported variable to the job with
`systemd-run --setenv=NAME=value`. `--pipe` keeps `systemd-run` alive
for the whole job, so `/proc/PID/cmdline` shows every value for the
run's length. `cmdline` is world readable, so any local user reads
them.

In an OpenChamber session the values include
`OPENCODE_JWT_SECRET`, `OPENCODE_PASSWORD`,
`OPENCODE_SERVER_PASSWORD`, `OPENCHAMBER_AGENT_TOOL_TOKEN`,
`OPENCHAMBER_UI_PASSWORD` and `SUPABASE_ACCESS_TOKEN`. A review
confirmed the leak against two running lanes.

- Keep every value off every argv.
- Forward the same variables, so `CLEAN`, `ARCHS`, `MONKEY_LOG_DIR`
  and `ANDROID_VERIFY_PORT` still reach the job.
- Carry a value with a newline, a quote and a `$` intact, or say what
  the transport cannot carry.
- Remove the transport as soon as the unit has started.

## Acceptance

- [ ] A fake secret in the caller never appears in `/proc/*/cmdline`
      while the job runs.
- [ ] The job still sees the secret, and the knobs above.
- [ ] A value with a newline, a quote and a `$` arrives intact.
- [ ] The transport is mode 600 while it lives and gone once the unit
      has started.
- [ ] Each test ends under `timeout` and uses
      `MONKEY_HEAVY_LOCK_FILE`, so no lane queues behind another.
- [ ] No test prints a real secret's value.

## Outcome

Shipped in #219.

- `heavy.sh` writes the caller's environment to a mode-600
  `monkey-heavy-env.<unit>.<random>` file under `$XDG_RUNTIME_DIR` and
  starts the unit with `-p EnvironmentFile=`. No value reaches an argv.
- The unit unlinks the file before its first line. The prelude unlinks
  it again once `systemd-run` returns, which covers a failed start.
  `-p Type=exec` makes that return a real start.
- Escaping every `\` and `"` carries a newline, `$`, a backtick, `%`,
  a tab and unicode intact. A NUL byte cannot arrive, and a value never
  holds one.
- The forwarded names do not change, so `CLEAN`, `ARCHS`, `MONKEY_LOG_DIR`
  and `ANDROID_VERIFY_PORT` still reach the job.
- Proof: `make test-heavy` passes, and three mutations fail it: the old
  `--setenv` path, no unit-side unlink, and the escape dropped. A live
  unit matched a 107-byte odd value by sha256. A `/proc/*/cmdline` scan
  during a job found no marker, and the same scan caught a planted
  `--setenv` leak.
- Amendment 2026-11-24 in ADR `20261118-fast-android-proof` records the
  transport and the rejected alternatives.
- `scripts/gate.sh full` passed at bc9f4d8 in 1732 s, 497 e2e passed.
  The close commit is prose, so it gets `fast`.
