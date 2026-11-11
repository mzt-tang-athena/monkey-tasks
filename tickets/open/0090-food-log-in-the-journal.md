---
id: 0090
title: Food log in the journal
created: 2026-11-11
priority: normal
assignee:
pr:
depends: [0089]
---

## Spec

The operator wants to log what they eat through the day. Keep it inside
the daily note, in the same interstitial blocks as the rest of the
journal. No new folder and no new note type.

Proposal: a food entry is a bullet that starts with `Ate: ` and ends
with the tag `#food` inside the same timestamp block.

```markdown
12:40
- Ate: [[oatmeal]] with milk #food
- Ate: [[chinese-steamed-eggs]] #food #protein
```

The `#food` tag is the machine marker. It is what Obsidian search and
Bases see, and what a future dashboard reads from the vault. The `Ate:`
prefix is for the eye only. Extra inline tags are the operator's own
labels, such as `#protein` or `#treat`. The app passes them through
untouched and never strips them.

The app does not build the dashboard. It keeps the marker stable and
parses it for today's Food line. Any dashboard added later reads the
vault tags, not app state. The same tag convention can carry other
trackers later, such as mood or energy, without a new note type.

The composer gets a Food toggle. With it on, the bullet is prefixed
`Ate: `, ends with `#food`, and the field offers the reference picker
from ticket 0091 when that exists. With it off, the bullet is plain
text.

The journal screen gains a Food line for today, quiet, under the
composer. It lists the `Ate:` bullets from today's blocks, newest
last, and counts them. It is a reading of the note, not a second store.
Do not build calories, macros or portions yet.

A `[[name]]` inside a food line is a reference link. Tapping it opens a
read-only preview of `References/<name>.md`, or says the note is
missing. The link is the same convention Obsidian uses.

## Acceptance

- [ ] A food entry sent from the composer appears as
      `- Ate: ... #food` under the current time, and survives a
      re-read.
- [ ] Extra inline tags on a food line are kept byte for byte. The
      parser finds the entry by `#food`, not by the `Ate:` prefix.
- [ ] The Food line lists today's entries and updates after a send.
- [ ] A `[[reference]]` in a food line opens the reference preview. A
      missing note says so and does not crash.
- [ ] The toggle keeps the last choice for the day and does not change
      the plain composer.
- [ ] No new folder, no new note type, no nutrition totals.
- [ ] 44pt targets, named controls, TalkBack reads the entries, axe
      clean. e2e covers a food send and the preview.

## Outcome

(filled in before moving to done/)
