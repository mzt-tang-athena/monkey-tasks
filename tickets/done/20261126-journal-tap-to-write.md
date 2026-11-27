---
title: Design the Journal tab around tap to write
created: 2026-11-26
priority: normal
assignee: claude-journal-design
pr: 268
depends: []
---

## Spec

The operator's feedback on 2026-11-26. Today a Journal entry starts from
the Add button. Instead, a tap on the journal area raises the keyboard.
The bottom line waits for text, with a timestamp on its left. The Add
button in this tab gets a different job.

The operator wants a separate session to settle the design first. No
code ships before they agree it.

Open questions for that session:

- What the timestamp records, and when a new line gets one.
- What the Add button does on this tab.
- How an entry ends, and how an older line gets edited.

## Acceptance

- [x] The operator agrees a design in its own session.
- [x] An ADR records the design.

## Outcome

The operator settled the design on 2026-11-27. ADR
`20261127-journal-tap-to-write` records it. They added two asks in
the session: done tasks as a log, and `@` to find a reference.

Three tickets build it:

- `20261127-journal-writes-on-the-page`
- `20261127-journal-at-finds-a-reference`
- `20261127-journal-logs-done-tasks`
