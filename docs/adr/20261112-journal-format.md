# The journal format

- **Status:** accepted
- **Date:** 2026-11-12

## Context

Tickets 0088, 0089 and 0090 add a journal to the app. The vault already
holds the notes at `Journal/Daily/YYYY-MM-DD.md`. Each note has frontmatter
for a banner, then time blocks, then a `![[daily.base]]` embed.

The app appends to these notes. Obsidian still edits them. The format
must settle before we build any screen. The parser, the composer and the
food marker all depend on it. We expect to revise the format after use.

## Decision

A block starts at a line that is only a time, `HH:MM`, and owns the bullet
lines under it. The screen shows blocks in file order, newest last.

One add writes one new block. Each line the operator typed becomes a `- `
bullet under that time. The time is local.

The app creates a missing note as an empty body. No frontmatter, no banner,
no embed, no template.

The screen reads as a lined journal. The tab's add button opens the entry
composer, and on that tab it adds an entry, not a task. The time sits on the
left of each entry. A sent entry slides up to sit below the latest entry.

A food entry is a bullet in a normal block:

```markdown
12:40
- Ate: [[oatmeal]] with milk #food
```

`#food` is the machine marker. `Ate: ` is for the eye only. The parser finds
food by the tag, so a food bullet without the prefix still counts. Extra
inline tags such as `#protein` stay byte for byte.

The entry composer has a Food chip. A quiet Food line sits under the
composer. It lists today's `Ate:` bullets, newest last, and counts them. It
reads the note and holds no state. Calories and other stats go in that same
place later, when the vault holds food amounts.

## Consequences

The format stays small and tolerant. A future dashboard reads vault tags,
not app state, so it needs no app support.

New notes lack a banner and the embed, so they look plainer than notes that
Obsidian creates. The app cannot edit or delete an entry, because it only
appends. The Food line counts entries but has no calories yet.

The food marker is provisional. We picked `- Ate: ... #food` without full
confidence and will revisit it after using the journal. Changing it takes
one parser line and a rewrite of existing lines.

We rejected a frontmatter key, because every append would rewrite the
frontmatter and break append only. We rejected a bare `Ate: ` prefix with
no tag, because Obsidian search and Bases read tags more reliably than
bullet text.

## Amendment, 2026-11-14: the first build

The app has a Journal tab now. We built the format above, with these
changes and details.

Creation happens on the first send, not when the tab opens. An empty note
made on open can race Obsidian creating the same daily note through sync.
The app's rule is that a read never writes. The first send makes
`Journal/` and `Journal/Daily/` when they are missing.

One send writes one block: a zero padded `HH:MM` line, then one `- `
bullet per non-empty typed line. A retry writes the block it built the
first time, at that minute. Only a retry skips a block that already ends
the note, so a lost response cannot double an entry. A first send always
appends, so two equal entries in the same minute both land.

The page is a ruled sheet. One rule is 28 points. Every vertical value
on the page is a whole number of rules, so wrapped text lands on them. The
time sits in a rail on the left, on the first line of its block. One
hairline in `accentSoft` marks the notebook margin. The date is the serif
display face, above the rules.

The composer is a sheet, like task capture. It rides the keyboard, and the
bottom bar slides away on the same clock. Send closes the sheet and writes
behind it. A sent block rises into place after the sheet leaves, so the
operator sees the rise. Reduced motion keeps no travel and no wait.

A food bullet shows `Ate` in the accent color and hides the `#food`
marker. Other tags stay quiet. A quiet Food band above the bottom bar
shows the count and the labels, newest last. It always draws, so later
stats cause no layout jump.

The note text is the single source of truth. The query cache holds it, and
`lib/journal/format.ts` derives blocks and food from it. The append is
optimistic with `planAppend`, the same function the file write uses. The
write shares `VAULT_SCOPE` with the task writes, so the vault takes one
write at a time. The journal reads no task state and has its own store.

A `[[name]]` link opens a read-only sheet with `References/<name>.md`. A
missing note says so and changes nothing.

The Journal dock answers no capture request. The command pane's "Add task"
means a task, so it stays inert on this tab.

v1 does not edit or delete an entry. It does not count calories. The food
marker stays provisional.

## Amendment, 2026-11-14: consequences of the first build

New notes still look plainer than notes that Obsidian creates. The page
opens at its newest line, so a long day opens below its date. The app
cannot fix a typo in place, because it only appends. The tab fits three
destinations at 360 points; ticket 0095 owns the fourth.

The Food band shows labels, not portions. A dashboard that reads the tags
can arrive before the app shows any number from them.

