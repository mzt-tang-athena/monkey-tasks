---
id: 0095
title: Notes tab from Inbox
created: 2026-11-11
priority: normal
assignee: opencode
pr:
depends: [0083]
---

## Spec

The operator wants a quick capture surface for thoughts, close to
Google Keep, that shows the notes in `Inbox/`. The tab is a place to
dump something and sort it later.

The folder today holds about 25 notes. Most are named
`YYYYMMDDHHMM.md`. A few add a slug, such as
`20260919-flight-email-tracker.md`, and a few are plain slugs. Most
have no frontmatter. The content is arbitrary markdown, sometimes an
indented paste. So the surface must read a note with no frontmatter,
no title and no fixed shape.

v1:

- A Notes tab lists `Inbox/*.md` as cards, newest first. A card's
  title is the note's name. A bare `YYYYMMDDHHMM` name shows as the
  local date and time. Every other name shows exactly as written, with
  no slug split, case change or join. The preview is the first body
  lines with the markdown marks stripped and the indentation
  flattened. Frontmatter is skipped.
- A composer creates a note. The title is optional. The default name
  is the local `YYYYMMDDHHMM`. A typed title adds a kebab slug, so the
  name becomes `YYYYMMDDHHMM-<slug>`. A collision gets a suffix. A new
  note has no frontmatter.
- Tap a card to open, read and edit. Save writes through the adapter
  with the read-check-write guard. A failed write keeps the draft.
- The Inbox folder is created on the first capture if it is missing.
- No pin, colour, labels, archive or checklist in v1.

Two design calls, now decided:

1. The bar shows symbols only, with no text labels under them. Every
   destination keeps a 44pt target and an accessible name. That fits
   four destinations plus Add at 360pt. Ticket 0089 adopts the result.
2. The tab is called Inbox Notes. `Notes` would clash with the separate
   `Notes/` folder of curated notes, and `Inbox` alone does not say
   what the surface holds.

The notes get their own query and do not use the task store. The
adapter already lists and reads any folder under the root.

## Acceptance

- [ ] The tab lists Inbox notes, newest first, with a card title from
      the note's name and a content preview. A note with no frontmatter
      works.
- [ ] A new note gets a unique name. Timestamp only by default, a slug
      when a title is typed, a suffix on a collision.
- [ ] A new note appears in Obsidian as a normal note in `Inbox/`.
- [ ] Open, edit and save round trip. A failed write keeps the draft.
- [ ] The bar layout and the tab label are recorded, and 0089 is
      amended.
- [ ] 44pt targets, named controls, TalkBack, axe clean. e2e covers
      list, create, open, save and the empty state.
- [ ] The card naming and sort rules are recorded in an ADR.
- [ ] The operator's design calls are recorded.

## Outcome

(filled in before moving to done/)
