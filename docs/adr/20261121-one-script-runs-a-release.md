# One script runs a release

- **Status:** accepted
- **Date:** 2026-11-21

## Context

Releases 1.0, 1.1 and 1.2 each ran the same eight steps by hand, from
scripts in `/tmp`. The order lived in a session and not in the repo.

Three tools promise to run releases:

- release-it bumps a version, tags and makes a release.
- semantic-release picks the version and publishes from CI.
- EAS builds in the cloud and submits to the app stores.

This app is a sideloaded APK. It has no store listing and no npm
package. Each release waits for a human to run the emulator smoke. The
APK comes from a local build with the debug key that `expo prebuild`
makes.

## Decision

Keep one local script, `scripts/release.sh <version>`. It runs the eight
steps in order and stops on the first failure.

- release-it would replace steps 2 and 7 only.
- The gate, the build, the smoke and the download stay ours.
- We would carry a dependency and a second source of truth.
- semantic-release would pick the version and publish from CI.
- A release here needs a chosen version and a smoke first.
- The tool publishes before a human can smoke the APK.
- EAS would move the build to the cloud and submit to a store.
- We ship a GitHub release asset and smoke it on this host.
- EAS does not do steps 1, 4, 5, 6 or 8.

## Consequences

The order lives in one place and a reviewer can rerun it. `--dry-run`
prints the plan and `--no-publish` rehearses every local step up to the
publish.

We make the tag at step 2 and push it at step 7. A failed smoke then
leaves nothing public.

The script needs local state: a full gate receipt for HEAD, the archive
folder and the emulator. It refuses when one is missing rather than
guessing.

The script is bash with fixture tests. A future move to a store would
make EAS worth a second look.
