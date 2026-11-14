---
id: 0089
title: The daily note and the journal tab
created: 2026-11-11
priority: high
assignee: claude-opus-5-5
pr: 143
depends: [0082, 0083]
---

## Spec

Add the journal to the app: a third tab, today's daily note, and an
append-only composer.

### Where the note lives

`Journal/Daily/YYYY-MM-DD.md`, two folders under the granted vault
root. The app already has a `VaultAdapter` that lists and reads any
folder. This work needs a new module, not a new adapter. Local time
decides the date and the entry time.

### What the app reads

The body has blocks. A block starts at a line that is only a time,
`^\\d{1,2}:\\d{2}$`. It owns the bullet lines under it until the next
block or a non-bullet line. Everything else stays intact, shown
read-only or not at all: the frontmatter, a `**To-do**` section, and
the trailing `![[daily.base]]` embed.

This format is v1. The operator expects to revise it after using it.
Keep the parser tolerant. The parser preserves unknown lines and keeps
extra inline tags. A block may hold any bullets. Never reject a note
because a block has a shape the app did not write.

The today view shows the blocks in file order, the newest last. The screen
reads as a lined journal. The time sits on the left of each entry. On this
tab the add button opens the entry composer instead of creating a task; we
may change that later. The composer is a multiline field and a send button.
Send appends one block at the current time, and the sent entry slides up to
sit below the latest entry.

One add is one block. Each line the operator typed becomes a `- ` bullet
under that time.

The format is in `docs/adr/20261112-journal-format.md`.

### What the app writes

Append only. Never rewrite an existing line. Read the whole note and
build the next text. Write it through the same read-check-write path the
task edits use. That way an Obsidian edit between the read and the write
is not lost. Insert the new block at the end of the body and before a
trailing embed line.

If the note does not exist, the first send creates it. The app writes an
empty body with no frontmatter and no embed. Opening the tab never creates
a note. An empty file made on open can race Obsidian's own daily note
through sync. Do not copy a banner from another note and do not run
Templater. The ADR records this choice.

### The tab

`app/src/app/(tabs)/journal.tsx`, thin, re-exporting
`features/journal`. The bottom bar gains a Journal destination. Ticket
0095 adds a Notes destination and owns the final bar layout. The bar
gains a destination, so check the hierarchy and the labels at 360pt
before hardcoding a fourth tab. Keep every target 44pt.

### State

A read runs on mount, on folder grant, on pull to refresh and on return
to the foreground. The task store reads at the same moments. A failed read shows
the same repair banner pattern. A failed append keeps the draft and
shows a retry. The screen does not use the task store.

## Acceptance

- [x] The tab opens today's note. A day with no note shows an empty page,
      and the first send creates the note.
- [x] A sent entry appears as `HH:MM` then the bullets, above the
      embed, with local time.
- [x] The note opens in Obsidian unchanged apart from the new block.
      No existing line moves, and the embed stays last.
- [x] An Obsidian edit between the read and the write is not
      clobbered. The app reports it.
- [x] The composer keeps its draft across a failed write and retries.
- [x] 44pt targets, named controls, a screen reader can read every
      entry, and the composer reports its state.
- [x] axe clean. e2e covers open, send, create, the failed write and
      the reduced motion project.
- [x] An ADR records the path, the block grammar, append-only and the
      create choice.

## Outcome

Shipped in #143. A third tab opens today's note as a ruled page, and the
tab's add button opens a sheet composer. One send writes one block and
appends it before the trailing embed. The first send creates the note.
Opening the tab only reads. The journal store has its own query and shares
the vault read gate and `VAULT_SCOPE` with the task writes. The sent block
rises after the sheet leaves, and reduced motion keeps no travel.

Verified with 876 unit and component tests, and the journal e2e in both
motion projects. Axe passes on the page and the open composer. The web
preview holds at 412 and 360 in light and midnight.
