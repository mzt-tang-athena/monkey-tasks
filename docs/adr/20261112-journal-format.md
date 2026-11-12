# The journal format

- **Status:** accepted
- **Date:** 2026-11-12

## Context

Tickets 0088, 0089 and 0090 add a journal to the app. The vault already
holds the notes at `Journal/Daily/YYYY-MM-DD.md`. Each note has frontmatter
for a banner, then time blocks, then a `![[daily.base]]` embed.

The app appends to these notes. Obsidian still edits them. The format must
settle before we build any screen, because the parser, the composer and the
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
