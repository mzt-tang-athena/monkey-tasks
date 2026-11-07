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

Main moved to the shared `@mzt-tang-athena/vale-rules` pack in PR #78
and kept the package token out of the repo in PR #85. The epic branch forked before both. The pack
adds `SentenceLength`, which flags sentences over 20 words.

The epic's README, ADRs and tickets now hold sentences that pass the
epic's own Vale config but fail the pack. On 2026-11-07, the README on
the epic tip gave 19 `SentenceLength` alerts under the pack. When PR
#68 merges the epic into main, main's docs job runs the pack and fails.

Agents on this machine already hit it: the pre-commit hook loads the
user's global pack from `~/.local/share/vale/styles/MyRules`, so a
merge of the epic into a branch fails the hook on text the branch did
not write.

Merge `main` into `epic/0047-rebuild` now, resolve the conflicts, and
split every flagged sentence. Do it before phase 4, so each later PR
runs the same rules as main.

## Acceptance

- [ ] `epic/0047-rebuild` contains main's commits from PRs #78 and #85.
- [ ] The CI docs job on the epic runs `npx vale-rules sync` and passes.
- [ ] Vale with the pack prints nothing on the epic's tracked Markdown.
- [ ] The pre-commit hook passes on a commit that touches `README.md`.

## Outcome

(filled in before moving to done/)
