---
title: The Journal shows today's done tasks
created: 2026-11-27
priority: normal
assignee:
pr:
depends: [20261127-journal-writes-on-the-page]
---

## Spec

Build the done log in ADR `20261127-journal-tap-to-write`. The page
reads today's ticked tasks live. It writes nothing to the daily note.

- A `completed` with a time sits in the timeline at that time.
- A done row shows muted, with a check, and takes no edit.
- A `completed` with only a date sits in a "Done today" group under
  the day's title.
- A tap on a done row opens the task editor.
- An untick removes the row.

Say how a recurring task's tick shows, since it may not keep
`completed`.

## Acceptance

- [ ] A task ticked at 18:08 shows between the blocks around it.
- [ ] A date-only tick shows in "Done today".
- [ ] An untick removes the row with no daily note change.
- [ ] Emulator frames of a page with both kinds.

## Outcome

(filled in before moving to done/)
