---
title: The Inbox tab drops its title
created: 2026-11-25
priority: normal
assignee: lane-inbox-title
pr:
depends: []
---

## Spec

The operator's feedback on 2026-11-25: the Inbox tab doesn't need the
words "Inbox Notes" at its top. `inbox-header.tsx` draws them beside
the note count.

- Remove the title. Keep the note count as a small line, unless frames
  show it orphaned. Then show the operator both.
- Keep the tab's accessible name, so TalkBack still names the screen.
- Check the other tabs for the same title. Ask before removing one.

## Acceptance

- [ ] The Inbox tab shows no "Inbox Notes" title on the phone.
- [ ] TalkBack still names the screen.
- [ ] Emulator frames before and after.

## Outcome

(filled in before moving to done/)
