---
id: 0071
title: Bring main's shared Vale rules into the epic branch
created: 2026-11-07
priority: high
assignee:
pr:
depends: []
---

## Spec

Main moved to the shared `@mzt-tang-athena/vale-rules` pack in PR #78.
It kept the package token out of the repo in PR #85. The epic branch
forked before both. The pack adds `SentenceLength`, which flags
sentences over 20 words.

Main's docs job runs Vale on `git ls-files '*.md'`. The `[**.md]`
section in `.vale.ini` matches only files at the repo root under the
pinned Vale 3.24.0. So the job lints `README.md` and `AGENTS.md` only.

On 2026-11-07, the epic's `README.md` gave 19 `SentenceLength` alerts
under the pack. `AGENTS.md` takes main's clean copy at the merge. When
PR #68 merges the epic into main, main's docs job fails on the README.

Agents on this machine hit it already. The pre-commit hook also loads
the user's global pack from `~/.local/share/vale/styles`. A merge of
the epic into a branch then fails the hook on text the branch did not
write.

Merge `main` into `epic/0047-rebuild` and resolve the conflicts. Split
each flagged sentence in `README.md`. Do it before phase 4, so each
later PR runs the same rules as main.

Out of scope: the ADRs and tickets. Under the pack they hold about 390
`SentenceLength` alerts, but no CI job lints them, and done tickets are
history. Whether the docs job should lint nested files is a separate
call.

## Acceptance

- [ ] `epic/0047-rebuild` contains main's commits from PRs #78 and #85.
- [ ] The CI docs job on the epic runs `npx vale-rules sync` and passes.
- [ ] Vale with the pack prints nothing on `README.md` and `AGENTS.md`.
- [ ] The pre-commit hook passes on a commit that touches `README.md`.

## Outcome

(filled in before moving to done/)
