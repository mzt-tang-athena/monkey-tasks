---
id: 0089
title: The daily note and the journal tab
created: 2026-11-11
priority: high
assignee:
pr:
depends: [0082, 0083]
---

## Spec

Add the journal to the app: a third tab, today's daily note, and an
append-only composer.

### Where the note lives

`Journal/Daily/YYYY-MM-DD.md`, two folders under the granted vault
root. The app already has a `VaultAdapter` that lists and reads any
folder, so this needs a new module, not a new adapter. Local time
decides the date and the entry time.

### What the app reads

The body has blocks. A block starts at a line that is only a time,
`^\\d{1,2}:\\d{2}$`, and owns the bullet lines under it until the next
block or a non-bullet line. Everything else is preserved and shown
read-only or not at all: the frontmatter, a `**To-do**` section, and
the trailing `![[daily.base]]` embed.

The today view shows the blocks in file order, the newest last. A
composer sits at the bottom with a multiline field and a send button.
Send appends one block at the current time.

### What the app writes

Append only. Never rewrite an existing line. Read the whole note, build
the next text, and write it through the same read-check-write path the
task edits use, so an Obsidian edit between the read and the write is
not lost. Insert the new block at the end of the body and before a
trailing embed line.

If the note does not exist, create it. Proposal: create an empty body
with no frontmatter and no embed. Do not copy a banner from another
note and do not run Templater. Record the choice in the ADR.

### The tab

`app/src/app/(tabs)/journal.tsx`, thin, re-exporting
`features/journal`. The bottom bar becomes Lists, Planner, Journal and
the Add action. Keep the nav a `tablist`, keep every target 44pt, and
keep the Add action where it is.

### State

A read runs on mount, on folder grant, on pull to refresh and when the
app returns to the foreground, like the task store. A failed read shows
the same repair banner pattern. A failed append keeps the draft and
shows a retry. The screen does not use the task store.

## Acceptance

- [ ] The tab opens today's note. A day with no note creates one, and
      the second open reuses it.
- [ ] A sent entry appears as `HH:MM` then the bullets, above the
      embed, with local time.
- [ ] The note opens in Obsidian unchanged apart from the new block.
      No existing line moves, and the embed stays last.
- [ ] An Obsidian edit between the read and the write is not
      clobbered. The app reports it.
- [ ] The composer keeps its draft across a failed write and retries.
- [ ] 44pt targets, named controls, a screen reader can read every
      entry, and the composer reports its state.
- [ ] axe clean. e2e covers open, send, create, the failed write and
      the reduced motion project.
- [ ] An ADR records the path, the block grammar, append-only and the
      create choice.

## Outcome

(filled in before moving to done/)
