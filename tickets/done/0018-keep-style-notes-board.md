---
id: 0018
title: Keep-style notes board in the Notes tab
created: 2026-10-20
priority: low
assignee:
pr:
depends: []
---

## Spec

A Keep-inspired notes view for the deferred Notes tab. It shows a
masonry grid of note cards over a vault inbox folder (or directory
view). Tapping plus creates a new note in the inbox with a
zettelkasten-style timestamp title (like 202610201551). The typed
content lands in the body, unless the user explicitly names the title
first. Cards show title and body preview; tapping opens the note.

The Notes tab itself remains deferred; this ticket defines the first
view for it. The dashboard-integration idea (athena operational
dashboard inside the app) stays out. The plan's later list notes it as
an idea only.

## Acceptance

- [ ] a masonry board renders vault notes as cards
- [ ] plus creates an inbox note with timestamp title, body first
- [ ] an explicitly named title wins over the timestamp

## Outcome

Superseded by `0095-notes-tab-from-inbox` on 2026-11-11. The idea is
the same. The newer ticket carries the current spec, the title rule and
the design questions. No code shipped from this ticket, and its
acceptance items moved to 0095.
