---
id: 0090
title: Food log in the journal
created: 2026-11-11
priority: normal
assignee: claude-opus-5-5
pr: 143
depends: [0089]
---

## Spec

The operator wants to log what they eat through the day. Keep it inside
the daily note, in the same interstitial blocks as the rest of the
journal. No new folder and no new note type.

Proposal: a food entry is a bullet that starts with `Ate: ` and ends
with the tag `#food` inside the same timestamp block. This marker is
provisional. We picked it without full confidence and will revisit it
after using the journal. Only the parser and the writer depend on it.

```markdown
12:40
- Ate: [[oatmeal]] with milk #food
- Ate: [[chinese-steamed-eggs]] #food #protein
```

The `#food` tag is the machine marker. Obsidian search and Bases see
it, and a future dashboard reads it from the vault. The `Ate:`
prefix is for the eye only. Extra inline tags are the operator's own
labels, such as `#protein` or `#treat`. The app passes them through
untouched and never strips them.

The app does not build the dashboard. It keeps the marker stable and
parses it for today's Food line. Any dashboard added later reads the
vault tags, not app state. The same tag convention can carry other
trackers later, such as mood or energy, without a new note type.

The entry composer gets a Food chip. With it on, the bullet starts with
`Ate: ` and ends with `#food`. The field then offers the reference
picker from ticket 0091 when that exists. With it off, the bullet is
plain text.

The journal screen gains a quiet Food line under the composer. It lists
the `Ate:` bullets from today's blocks, newest last, and counts them.
The line reads the note instead of keeping a second store. The line is
where calories and other stats go later, once the vault holds food
amounts. Do not build calories, macros or portions yet.

A `[[name]]` inside a food line is a reference link. Tapping it opens a
read-only preview of `References/<name>.md`, or says the note is
missing. The link is the same convention Obsidian uses.

## Acceptance

- [x] A food entry sent from the composer appears as
      `- Ate: ... #food` under the current time, and survives a
      re-read.
- [x] The app keeps extra inline tags on a food line byte for byte.
      The parser finds the entry by `#food` instead of the `Ate:`
      prefix.
- [x] The Food line lists today's entries and updates after a send.
- [x] A `[[reference]]` in a food line opens the reference preview. A
      missing note says so and does not crash.
- [x] The Food chip keeps the last choice for the day and does not change
      the plain composer.
- [x] No new folder, no new note type, no nutrition totals.
- [x] 44pt targets, named controls, TalkBack reads the entries, axe
      clean. e2e covers a food send and the preview.

## Outcome

Shipped in #143. A food entry is `- Ate: ... #food` inside a normal
block. The parser finds it by the tag, not by the prefix, and keeps
other tags byte for byte. The composer has a Food chip, and a quiet band
above the bottom bar shows the count and the labels. A `[[name]]` opens
a read-only preview of `References/<name>.md`.

The marker stays provisional until the operator uses it for a while.
