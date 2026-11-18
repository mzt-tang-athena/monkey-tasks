---
id: 0095
title: Notes tab from Inbox
created: 2026-11-11
priority: normal
assignee: opencode
pr: 164
depends: [0083]
---

## Spec

The operator wants a quick capture surface for thoughts, close to
Google Keep. It shows the notes in `Inbox/`. The tab is a place to dump
something and sort it later.

The folder today holds about 25 notes. Most carry a stamp name,
`YYYYMMDDHHMM.md`. A few add a slug, such as
`20260919-flight-email-tracker.md`, and a few carry a plain slug. Most
have no frontmatter. The content is arbitrary markdown, sometimes an
indented paste. The surface must read a note with no frontmatter, no
title and no fixed shape.

v1:

- A Notes tab lists `Inbox/*.md` as cards, newest first. A card's
  title is the note's name. A bare `YYYYMMDDHHMM` name shows as the
  local date and time. Every other name shows exactly as written, with
  no slug split, case change or join. The preview holds the first body
  lines with the markdown marks stripped and the indentation
  flattened. The card skips the frontmatter.
- A composer creates a note. The title stays optional. The default
  name is the local `YYYYMMDDHHMM`. A typed title adds a kebab slug, so
  the name becomes `YYYYMMDDHHMM-<slug>`. A collision gets a suffix. A
  new note has no frontmatter.
- Tap a card to open, read and edit. Save writes through the adapter
  with the read-check-write guard. A failed write keeps the draft.
- The first capture makes the Inbox folder when the folder is missing.
- No pin, colour, labels, archive or checklist in v1.

Two design calls, now decided:

1. The bar shows symbols only, with no text labels under them. Every
   destination keeps a 44pt target and an accessible name. That fits
   four destinations plus Add at 360pt. Ticket 0089 adopts the result.
2. The tab name is Inbox Notes. `Notes` would clash with the separate
   `Notes/` folder of curated notes. `Inbox` alone does not say what
   the surface holds.

The notes get their own query and do not use the task store. The
adapter already lists and reads any folder under the root.

## Acceptance

- [x] The tab lists Inbox notes, newest first, with a card title from
      the note's name and a content preview. A note with no frontmatter
      works.
- [x] A new note gets a unique name. Timestamp only by default, a slug
      when the user types a title, a suffix on a collision.
- [x] A new note appears in Obsidian as a normal note in `Inbox/`.
- [x] Open, edit and save round trip. A failed write keeps the draft.
- [x] The records hold the bar layout and the tab label, and ticket
      0089 adopts them.
- [x] 44pt targets, named controls, TalkBack, axe clean. e2e covers
      list, create, open, save and the empty state.
- [x] The card naming and sort rules live in an ADR.
- [x] The records hold the operator's design calls.

## Outcome

Shipped in #164. The Inbox Notes tab lists `Inbox/*.md` as a two-column
card grid, newest first. A bare stamp name reads as a local date and
time; every other name shows as the file holds it. A capture is one
body field with an optional title behind a reveal, and the first one
makes the folder. The editor edits the body and keeps frontmatter byte
for byte. A conflict offers Save a copy. ADRs
`20261117-inbox-note-model` and `20261117-icon-only-bottom-bar` hold
the card model and the four-destination bar.

The spec, `app/e2e/specs/inbox-notes.spec.ts`, covers the grid, a
capture, a typed title and two captures in one minute. It also covers a
failed capture and its retry, the empty folder, and open and save. A
case covers a conflict and Save a copy, an outside write and a
foreground read. It also scans the screen, the composer and the editor
with axe. The a11y spec adds the tab and the composer to the
touch-target walk. The verify journey at
`app/build/verify/evidence/20261118-012953` drives a capture and an
edit, then reads the vault back. The full web suite had 604 passed and
26 skipped, and 1166 unit tests passed.

The web cannot prove TalkBack, real SAF writes or keyboard insets.
TalkBack on the four tabs and the note composer stays with the phone
pass.
