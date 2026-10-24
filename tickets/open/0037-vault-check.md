---
id: 0037
title: A command checks the whole vault
created: 2026-10-24
priority: normal
assignee:
pr:
depends: [0032]
---

## Spec

A CLI validates the whole vault with `@monkey-tasks/schemas`. It walks
every note under a vault path and reports three kinds of finding:

- A note that fails validation, with each schema error.
- A bare wikilink: a `[[...]]` value with no quotes. A strict YAML
  parser reads it as an array, so the link changes shape (0032).
- A note where the app's parse and `js-yaml` disagree. The app reads
  `- 07:00` and a bare link its own way; `js-yaml` reads them another.
  Flag every note where the two values differ.

Each finding names the file and the reason. The command exits non-zero
when it finds anything, so a hook can run it. A clean vault exits zero.

Keep the check in a pure function over a folder path, and the command a
thin wrapper, so a test can point it at a temp folder. The schemas
package already holds the app's frontmatter parse, so both sides use the
same code. The command runs under Node with the repo's TypeScript
tooling and needs no phone or vault grant.

Out of scope: automatic fixes.

## Acceptance

- [ ] One command runs over a vault path and checks every note in it.
- [ ] Each finding names the file and the reason.
- [ ] A clean vault exits zero.
- [ ] A test covers each finding kind: invalid note, bare wikilink,
      parser disagreement.
- [ ] The README documents the command, its argument and its exit
      codes.

## Outcome

(filled in before moving to done/)
