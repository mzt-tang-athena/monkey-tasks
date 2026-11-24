# Fast Android proof by swapping the JS bundle

- **Status:** accepted
- **Date:** 2026-11-18

## Context

Every lane builds a release APK to prove its change on the emulator. A
full build took 43 minutes on this host today. Builds, full e2e runs
and emulator passes share one lock, so each build delays the others by
that much.

Most lane changes touch only JavaScript. The native layer stays the
same. Building it again proves nothing about the change.

## Decision

Keep one release APK per native fingerprint. When a checkout's
fingerprint matches a base APK, replace only `assets/index.android.bundle`
and `assets/app.config`, then align and sign with the base's key.

`scripts/android-apk.sh` does this and falls back to the full build when
it cannot swap. A swapped APK is for the emulator only. A release
builds with `build-apk.sh` and `CLEAN=1`, and a tagged commit forces
the full path in the script.

We key the cache on the `@expo/fingerprint` project hash plus a digest
of the exported JS assets. The fingerprint covers the app config, the
dependencies and the native assets. The asset digest covers an image
that changed bytes but kept its name, which the fingerprint does not
see.

The swap runs without the heavy lock. It took 46 seconds with a warm
Metro cache, and 97 seconds beside another lane's build, in two runs.
The JS export bounds it at 24 to 89 seconds. Only the export
serializes, on `/tmp/monkey-tasks-js-export.lock`, because Metro binds
port 8081.

## Consequences

A lane that matches a base gets an APK in about a minute instead of
43. The first lane on a new fingerprint still pays the full build and
seeds the cache for the rest.

The swapped bytecode matches the full build byte for byte, apart from
two header hashes. The export must pass `--minify true` and
`--sourcemap-output`. Without the source map flag, Hermes compiles
without debug locations and the bundle grows by 22 percent.

What a swap does not pick up:

- A new or renamed JS asset. The asset digest changes, so it misses.
- A native change. The fingerprint changes, so it misses.
- A version code change in the manifest. The fingerprint skips
  versions under the balanced preset. The script regenerates
  `app.config`, but not the manifest. A version bump means a release,
  so this stays a full build by hand.

Signing uses the debug key that `expo prebuild` writes, which is the
key the release build uses. The script refuses to sign when the
keystore's certificate does not match the base APK's signer.

The swap keeps the base APK's native libraries, resources and
`classes.dex`, so it cannot prove a native change. Say so in the
report when a lane touches native code.

We keep the emulator running between passes instead of using a
quick-boot snapshot. A running emulator costs 2 GB and no boot time.
A cold pass spent 72 seconds before it seeded the vault. A relaunch on
the running emulator seeded in 10 seconds. A snapshot would save that
boot only when the emulator must stop. It adds a save on every stop,
and its restore path is flaky under software rendering.

## Amendment 2026-11-18: scripts in the skill, one CPU type

The full build, the web suite and the release smoke lived in a
scratch folder outside the repo. A restart would have wiped them, and
`android-apk.sh` called the build there. They now live in the skill as
`android-build.sh`, `web-suite.sh` and `android-release-smoke.sh`.

A proof build now compiles native code for x86_64 only, the
emulator's CPU type. Before, it compiled four CPU types, and most of
the 43 minutes went to that. The cost is that a proof APK does not
install on the phone. A release still builds every CPU type with
`CLEAN=1`. We rejected arm64 plus x86_64. No lane puts a proof APK
on the phone, and arm64 doubles the native compile.

## Amendment 2026-11-20: heavy jobs start their own unit

Every heavy job used to arrive with two lines typed by hand. First a
`systemd-run` wrapper with the memory cap. Then a wait loop on
`systemctl --user is-active`. A lane that forgot the wrapper let a
runaway build take OpenChamber down with it. A lane that forgot the wait
read its own healthy job as a hang.

The three scripts now do this themselves through one prelude,
`scripts/heavy.sh`. Started from a shell, each script runs again in its
own transient unit, capped at 8G. It waits for that unit and returns the
job's exit code. `--background` starts the unit and returns its name at
once. `MONKEY_HEAVY_LOCK=1` still means a caller holds the lock, so that
run stays in place and nothing nests. The shared lock still runs one job
at a time.

The unit gets the caller's whole environment, not only `HOME` and
`PATH`. The old wrapper dropped `CLEAN`, `ARCHS`, `MONKEY_LOG_DIR` and a
lane's `ANDROID_VERIFY_PORT`. Forwarding the whole environment also
means a new knob works without a change to the prelude.

`heavy-emulator.sh <script>` runs any emulator script under both locks.
It takes the heavy lock first, then the emulator lock. Its unit sets
`KillMode=process`. A unit otherwise kills what its main process leaves
behind. That would shut the emulator down at the end of every launch.

Rejected: a wrapper script beside the three that callers run instead.
Callers would still have to choose it, and the scripts would stay wrong
on their own.

## Amendment 2026-11-24: the environment reaches the unit in a file

The unit still gets the caller's whole environment. It now arrives in a
mode-600 file under `$XDG_RUNTIME_DIR`, not in `--setenv` flags.

`--setenv=NAME=value` put every value in `systemd-run`'s argv. That
argv is world readable in `/proc/PID/cmdline`. `--pipe` keeps the
process alive for the whole job. An OpenChamber session exports
`OPENCODE_JWT_SECRET`, `OPENCHAMBER_UI_PASSWORD` and others, so any
local user could read them for a whole build.

`heavy.sh` writes the environment to
`monkey-heavy-env.<unit>.<random>`. It starts the unit with
`-p EnvironmentFile=`. Each line is `NAME="value"`.

Inside the quotes systemd reads only `\` and `"` specially. The writer
escapes those two, and every other byte stays literal, a newline
included. A NUL byte cannot arrive, and an environment value never
holds one.

The unit unlinks the file as its first act. The job's first line then
finds no file. The prelude unlinks the file again once `systemd-run`
returns, which covers a unit that never started. `-p Type=exec` makes
that return mean the unit has exec'd its command. The manager reads
the file before that exec, so the second unlink cannot race it.

Rejected: `systemctl --user set-environment`. The value lands in the
manager's environment. Every unit the user starts then sees it, not
only the heavy job. It stays until a reboot.

Rejected: `--setenv` for values that look harmless, the file for the
rest. That needs a list of secret names. The list rots the first time
a session exports a new token.

Consequences:

- A process of the same user can still read the job's
  `/proc/PID/environ`. The job needs the values, so no forwarding
  avoids that.
- A prelude killed between the write and the unit start leaves one
  mode-600 file in the runtime directory. tmpfs clears it at logout.
- A unit whose command is missing now fails the call. `Type=simple`
  reported success at the fork.
- The unit's first process is `/bin/sh`. It unlinks the file and execs
  the job in place, so the pid and the exit code still carry.
