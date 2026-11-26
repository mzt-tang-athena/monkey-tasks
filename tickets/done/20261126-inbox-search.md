---
title: Search the Inbox from its header
created: 2026-11-26
priority: normal
assignee: lane-inbox-view-search
pr: 250
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

- [x] The header holds a search bar.
- [x] Typing filters the cards by title and body.
- [x] Clearing the search restores every card.
- [x] Emulator frames with and without a search.

## Outcome

The Inbox header holds a search bar. It filters the cards as you type.
Every word must appear in the title or the whole body, in any case. A
clear button and an emptied field both restore every card. The count
line stays under the bar and reads "1 of 7 notes" while searching. The
three header designs are in `evidence-inbox-view-search/frames/`. Proof:
web spec in both motion modes, and emulator frames of a search in each
view. The screen tree names the field "search notes".
