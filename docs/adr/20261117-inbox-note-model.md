# 20261117. The Inbox note model

- **Status:** accepted
- **Date:** 2026-11-17

## Context

`Inbox/` holds about 25 markdown notes with no fixed shape. Most names
are a local stamp, `YYYYMMDDHHmm`. A few add a slug, and one legacy
shape puts a dash before the time. A few names carry no date. Most
notes have no frontmatter, so the file cannot say when someone wrote
it.

The vault port gives a note's uri and file name. It gives no
modification time. The operator wants a Google Keep style surface for
fast capture. The card title is the note's name. The card shows enough
content to know what the note is.

## Decision

The file name is the note's title and its sort key.

A bare `YYYYMMDDHHmm` stem shows as the local date and time, for
example `17 Nov 2026, 10:30`. Every other stem shows exactly as
written. We do not split off a slug, and we change no case. The provider's
` (n)` collision suffix stays on a stamped name, so the title still
names the file.

The list sorts by the date in the name, newest first. A date without a
time sorts at the start of its day. A name with no date sorts after
the dated notes, by name. We add no modification time to the port.

A card shows the note's body as plain text. The preview skips the
frontmatter and strips the markdown marks. It flattens the indentation,
so an indented paste reads as prose and not as code. It shows at most
eight lines and 240 characters. The cards sit in two columns.

A new note has no frontmatter. Its name is the local stamp, with a
kebab slug when the user typed a title. A collision is the provider's
` (n)`, with no pre-check and no rename loop. The first capture makes
the Inbox folder.

The editor edits the body. The frontmatter is an opaque head that
stays byte for byte. A save writes through the read-check-write guard
with the whole opened file as its expected text. A conflict keeps the
draft and offers Save a copy, Reload note and Keep editing. The app
never overwrites another writer's change.

v1 has no pin, colour, label, archive or checklist.

## Consequences

A capture is one field and no title. The card title is readable for a
stamped note and literal for every other note.

The app cannot place an undated note in time, because the vault does
not tell it when the file changed. A stamp in the name is the only
record of recency. A note whose name looks like a stamp but is not a
real date shows its raw stem.

The editor never corrupts frontmatter, and a save can refuse because
another app changed the head. The user resolves that refusal, and the
draft stays by default.

## Alternatives

**The first body line as the title.** It reads well for a dump, but
the operator chose the file name and the two would disagree.

**A modification time on the vault port.** SAF does not give a
reliable last-modified value for a content uri on every provider. The
change would widen the port, both adapters and the contract test for
one screen. It would also give the list a second recency rule.

**A `created` property on new notes.** The operator chose no
frontmatter for captures, and the Inbox has no schema for it.

**Overwrite on a conflict.** It gives the draft somewhere to go, but
it drops the other writer's change. Save a copy keeps both texts.
