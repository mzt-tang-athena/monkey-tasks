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
- [x] Vale prints nothing for every tracked doc, except the sample
      vault fixtures.
- [x] No code span, number, link, heading, or checkbox changes in
      meaning. One table in ADR 0036 gains backticks around package
      names.
- [x] Agent instructions keep every command, path, and step.
- [x] Operator quotes and literal test names stay verbatim.

## Outcome
Delegates reworded 171 docs: 54 ADRs, 109 tickets, six verify-skill
files, `app/AGENTS.md` and the epic handover. A script compared code
spans, numbers, links, and headings against `origin/main`. Reviewers read
every diff and restored more than 60 shifted meanings.

Eight docs from PRs 139 and 141 landed after this work began.
Their authors wrote them before the glob fix, so they carry the same
alerts. This change cleans them too. Without that, main would go red
on merge.

Three spots carry `<!-- vale off -->`. Two wrap operator quotes, in
0092 and 0093. One wraps a test name in 0052 that matches the code.

The sample vault notes under `app/src/lib/vault/sample/` get no styles.
They are parser fixtures.

Tickets 0009 and 0016 had a colon in an unquoted YAML title. The YAML
did not parse, and Vale failed on them. Both titles are now quoted.
Two titles changed wording to clear an alert, in 0019 and 0078.

This change rewords the four tickets still in `tickets/doing/` too. CI lints
every tracked doc, so the fixed glob styles them as well, and they held
22 alerts. None had changed since 11-11, so no session was mid-edit.
