---
title: The Inbox shows one column or two
created: 2026-11-26
priority: normal
assignee: lane-inbox-view-search
pr: 250
depends: []
---

## Spec

The operator's feedback on 2026-11-26. The Inbox shows its note cards in
two columns. Add a one-column view, like Google Keep's list view. A
button in the Inbox header switches between the two. The operator
sent a Keep screenshot as the reference.

- One column shows each card at full width, so more of a long note shows.
- The header button shows the view it switches to, as Keep's does.
- The choice persists across restarts, the way other settings persist.
- Ticket `20261126-inbox-search` puts a search bar in the same header.
  Design the header once for both.

## Acceptance

- [x] A header button switches between one and two columns.
- [x] The choice survives a restart.
- [x] TalkBack names the button and the view it picks (read from the
  screen tree, not heard).
- [x] Emulator frames of both views.

## Outcome

The Inbox header holds a view button inside its search bar. It names
the view it switches to: "switch to one column" or "switch to two
columns". One column draws full-width cards that show more of a long
note. The choice is the `inboxColumns` setting and survives a restart.
Proof: web spec in both motion modes, and emulator frames of both views
and a restart on port 5584. The screen tree carries the button's name.
The emulator image has no ready speech engine, so TalkBack's own
speech stays unheard.
