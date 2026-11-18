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

The swap runs without the heavy lock. It takes about two minutes on
one core, and lanes can run it beside a build. Only the JS export
serializes, on `/tmp/monkey-tasks-js-export.lock`, because Metro binds
port 8081.

## Consequences

A lane that matches a base gets an APK in about two minutes instead of
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
A snapshot would save about 80 seconds, and only when the emulator must
stop. It adds a save on every stop. Its restore path is flaky under
software rendering.
