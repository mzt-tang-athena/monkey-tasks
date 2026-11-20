---
title: One script runs a release
created: 2026-11-20
priority: normal
assignee:
pr:
depends: [20261119-release-checks-in-the-smoke, 20261120-heavy-jobs-run-in-their-own-unit]
---

## Spec

Releases 1.0, 1.1 and 1.2 each ran the same steps by hand, with
scripts in `/tmp`:

1. The full gate on the commit to tag.
2. An annotated tag, pushed.
3. A clean release build for every CPU type.
4. The APK and its `.sha256` copied out of the build tree.
5. The release smoke on the emulator.
6. Release notes cut from the tag's `CHANGELOG.md` section.
7. `gh release create --verify-tag` with the APK and checksum.
8. A download from the release, checked against the checksum.

Add `scripts/release.sh <version>` that runs them in order. It also
lists merged PRs since the last tag that lack a changelog line. It
stops if one changed visible app code.

Search first. Weigh release-it, semantic-release and EAS against the
local build. Record the outcome in the PR.

## Acceptance

- [ ] `--dry-run` prints every step and changes nothing.
- [ ] It refuses unless main is clean and the gate receipt passed.
- [ ] A failing smoke stops it before it publishes the release.
- [ ] The next release runs through it end to end.
- [ ] The verify skill and the README name it.

## Outcome

(filled in before moving to done/)
