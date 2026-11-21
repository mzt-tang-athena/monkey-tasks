---
title: One script runs a release
created: 2026-11-20
priority: normal
assignee: omp
pr: 207
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

- [x] `--dry-run` prints every step and changes nothing.
- [x] It refuses unless main is clean and the gate receipt passed.
- [x] A failing smoke stops it before it publishes the release.
- [ ] The next release runs through it end to end.
- [x] The verify skill and the README name it.

## Outcome

Shipped in #207. `scripts/release.sh <version>` runs the eight steps in
order and stops on the first failure. We make the tag at step 2 and push
it at step 7, so a failed smoke leaves nothing public.

- `--dry-run` printed every step and changed nothing. It exited 1 and
  named the blockers when the checkout was not ready.
- It refuses unless main is clean and level with `origin/main`. The app
  version must match a dated changelog section. The tag must be absent,
  and a full clean gate receipt must pass for HEAD.
- `scripts/check-release-notes.sh` lists merged PRs since the last tag
  with no changelog line. It fails when a visible app change has none.
- `--no-publish` runs every local step and deletes its tag.
- The release smoke counts failed checks and exits non-zero.
- A failed download check exits 1 and prints the retract commands. It
  never retracts the release by itself.
- Weighed release-it, semantic-release and EAS. ADR
  `20261121-one-script-runs-a-release` records why the local script won.
- Rehearsal at 1.3.0 on `ae09385`, after a full gate pass. It made the
  tag and a `CLEAN=1` build for four CPU types. It copied the APK and
  checksum, passed the smoke and cut the notes. It pushed nothing, made
  no release and deleted the tag.
- The first rehearsal's smoke failed a keyboard read and the release
  stopped before the notes, with no tag left. The same APK passed a
  second smoke on a quiet host. A 1.1.0 APK failed at launch and exited
  1.
- Final code head `863e281` passed `scripts/gate.sh full`.
- Evidence: `~/code/monkey-tasks/worktrees/evidence-release-script/`.
- `make ci` runs the two fixture tests.

The end-to-end box waits for 1.3.0, which the operator approves. The
first rehearsal hit a base smoke flake: one stranded handle frame of 27.
That fault sits in the smoke.

