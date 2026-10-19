---
id: 0001
title: Vault sync spike
created: 2026-10-17
priority: high
assignee: opencode
pr: 1
depends: []
---

## Spec

A bare Expo app installed on the phone by sideload. It gains folder access
to `Documents/obsidian-vault`, reads one task note, edits one property,
and writes the file back. This is the risk-first test of ADR 0002.

## Acceptance

- [ ] the app reads a note and shows its frontmatter
- [ ] the edit appears in Obsidian on desktop after LiveSync syncs
- [ ] a scheduled notification fires with the app closed
- [ ] a phone reboot does not drop a scheduled notification
