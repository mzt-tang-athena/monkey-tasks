# 0028. Duplicate task names keep a clean title

- **Status:** accepted
- **Date:** 2026-10-25

## Context

A task name is a file name. Android's document provider appends " (1)"
when the name is taken, so a second task called `draw` lands in
`draw (1).md`. The row showed the suffix after a refresh, and the user
read it as part of the name.

The alternatives were a UUID in the file name or inline checklists in
one note. A UUID makes the file unreadable in Obsidian, and links
cannot resolve it. Inline checklists change the unit of the vault from
a note to a line, and every link, deed, and list note would move with
it.

## Decision

We keep the provider's ` (N)` suffix in the file name. When the app
creates a note and the name it got differs from the name it asked for,
it writes `title: <requested name>` into the note. The display prefers
`title`, so the row keeps the name the user typed, before and after a
refresh.

A note made by hand in Obsidian has no title and shows its file name.
The app does not strip a suffix from a name it did not create, because
`(2)` can be part of a real name.

## Consequences

Duplicate names are allowed and read the same, which is how Google
Tasks behaves. The file name stays readable and links keep working.
The suffix is visible in Obsidian's file list, which is the place
where a unique name matters.

Free text now reaches the emitter through `title`, so `serializeValue`
quotes any value YAML would read as something else: a colon, a leading
indicator, a boolean, a number.

## Amendment, 2026-10-26: any file name that drops the typed name

The decision covered one way a file name can differ from the typed
name: the provider's ` (N)` suffix. The app has a second way.
`safeFileName` turns `/\:*?"<>|` into spaces and cuts a name at 80
characters. Capture took "Pay bill: water", wrote `Pay bill water.md`
with no title, and the row showed "Pay bill water" after the next read.

The rule is now wider (ticket 0053). When the app creates a note or
saves one from the editor, it writes `title` when the final file name,
without `.md`, differs from the typed name. The cause does not matter.
This covers an editor save with no rename too, because a cleaned name
can match the file the note already has.

A note that gets a title this way is a titled note. A later rename in
the editor changes the title, not the file. We did not swap a refused
character for a lookalike, such as a modifier colon. A lookalike breaks
every link a person types in Obsidian.

More notes now carry a title: every name with a refused character or
more than 80 characters. Their file names keep the first cleaned name.
