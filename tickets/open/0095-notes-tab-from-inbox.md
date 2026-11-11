---
id: 0095
title: Notes tab from Inbox
created: 2026-11-11
priority: normal
assignee:
pr:
depends: [0083]
---

## Spec

The operator wants a quick capture surface for thoughts, close to
Google Keep, that shows the notes in `Inbox/`. The tab is a place to
dump something and sort it later.

The folder today holds 24 notes. Most are named `YYYYMMDDHHMM.md`. A
few add a slug, such as `20260919-flight-email-tracker.md`, and a few
are plain slugs. 19 have no frontmatter and 5 do. The content is
arbitrary markdown, sometimes an indented paste. So the surface must
read a note with no frontmatter, no title and no fixed shape.

v1:

- A Notes tab lists `Inbox/*.md` as cards, newest first. The title is
  the note's own title, which is the file name. A timestamp name shows
  as a readable local date and time, such as 11 Nov 2026, 18:08. A slug
  name shows as words. Do not infer a title from the content. The first
  lines are the preview.
- A composer creates a note. The default name is the local
  `YYYYMMDDHHMM`. A typed title adds a kebab slug, so the name becomes
  `YYYYMMDDHHMM-<slug>`. A collision gets a suffix. A new note has no
  frontmatter.
- Tap a card to open, read and edit. Save writes through the adapter
  with the read-check-write guard. A failed write keeps the draft.
- The Inbox folder is created on the first capture if it is missing.
- No pin, colour, labels, archive or checklist in v1. The design
  session decides whether any of them belong.

Two open design calls:

1. The bar goes from two destinations to four plus Add. The measured
   widths fit at 360pt, but the hierarchy and the labels still need a
   decision. The design session decides, and ticket 0089 adopts the
   result.
2. The tab label. `Notes` is the operator's word, but the vault has a
   separate `Notes/` folder of 92 curated notes. `Inbox` names the
   actual folder and avoids the clash. Decide in the design session.

The notes get their own query and do not use the task store. The
adapter already lists and reads any folder under the root.

## Acceptance

- [ ] The tab lists Inbox notes, newest first, with the note's title
      and a content preview. A timestamp title reads as a date and
      time. A note with no frontmatter works.
- [ ] A new note gets a unique name. Timestamp only by default, a slug
      when a title is typed, a suffix on a collision.
- [ ] A new note appears in Obsidian as a normal note in `Inbox/`.
- [ ] Open, edit and save round trip. A failed write keeps the draft.
- [ ] The bar layout and the tab label are recorded. 0089 is amended.
- [ ] 44pt targets, named controls, TalkBack, axe clean. e2e covers
      list, create, open, save and the empty state.
- [ ] The design session has three directions and the operator's pick.

## Outcome

(filled in before moving to done/)
