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
ADR was ever checked. Change it to `[*.md]`. The change surfaces 9 errors
and 300 warnings in old docs. The pre-commit hook rejects any staged doc
with a warning, so clear them all. Change wording only.

## Acceptance
- [x] `make lint` reports 0 errors and 0 warnings.
- [x] No code span, number, link, heading, or status line changes.
      One table in 0036 gains backticks around package names.

## Outcome
Three delegates reworded 53 files. A script compared code spans,
numbers, links, and headings against `HEAD`.
