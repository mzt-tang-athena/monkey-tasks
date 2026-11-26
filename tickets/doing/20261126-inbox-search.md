---
title: Search the Inbox from its header
created: 2026-11-26
priority: normal
assignee: lane-inbox-view-search
pr:
depends: []
---

## Spec

The operator's feedback on 2026-11-26. Add a search bar to the Inbox
header, the way Google Keep does.

- Typing filters the cards to notes whose title or body matches.
- Clearing the search shows every card again.
- Ticket `20261126-inbox-one-column-view` puts a view button in the same
  header. Design the header once for both. Keep puts the view button
  inside its search bar.
- The note count line from ticket `20261125-inbox-drops-its-title` stays
  or merges into the bar. Show the operator the frames.

## Acceptance

- [ ] The header holds a search bar.
- [ ] Typing filters the cards by title and body.
- [ ] Clearing the search restores every card.
- [ ] Emulator frames with and without a search.

## Outcome

(filled in before moving to done/)
