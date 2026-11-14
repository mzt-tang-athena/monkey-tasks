---
title: Let Vale check every doc, and clear the backlog it finds
created: 2026-11-13
priority: normal
assignee: claude-code
pr: 138
depends: []
---

## Spec
`.vale.ini` used `[**.md]`. Vale matched only root files with it, so no
doc below the root was ever checked. Change it to `[*.md]`. The change
surfaces about 1,150 alerts in old docs. The pre-commit hook rejects
any staged doc with a warning. Clear them all, so an agent can edit any
doc without paying off old debt first. Change wording only.

## Acceptance
- [x] `make lint` reports 0 errors and 0 warnings.
- [x] Vale prints nothing for every tracked doc outside
      `tickets/doing/` and the sample vault.
- [x] No code span, number, link, heading, or checkbox changes in
      meaning. One table in ADR 0036 gains backticks around package
      names.
- [x] Agent instructions keep every command, path, and step.
- [x] Operator quotes and literal test names stay verbatim.

## Outcome
Delegates reworded 161 docs: 52 ADRs, 100 tickets, six verify-skill
files, `app/AGENTS.md`, the epic handover and `tickets/README.md`. A script
compared code spans, numbers, links, and headings against `origin/main`.
Reviewers read every diff and restored more than 50 shifted meanings.

Three spots carry `<!-- vale off -->`. Two wrap operator quotes, in
0092 and 0093. One wraps a test name in 0052 that matches the code.

The sample vault notes under `app/src/lib/vault/sample/` get no styles.
They are parser fixtures.

Tickets 0009 and 0016 had a colon in an unquoted YAML title. The YAML
did not parse, and Vale failed on them. Both titles are now quoted.
Two titles changed wording to clear an alert, in 0019 and 0078.

This change leaves `tickets/doing/` alone. Live sessions own those files, and the
hook will check each one when its session commits it.
