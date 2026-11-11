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

Proposal: a food entry is a bullet that starts with `Ate: ` inside a
timestamp block.

```markdown
12:40
- Ate: [[oatmeal]] with milk
- Ate: [[chinese-steamed-eggs]]
```

The composer gets a Food toggle. With it on, the bullet is prefixed
`Ate: `, and the field offers the reference picker from ticket 0091
when that exists. With it off, the bullet is plain text.

The journal screen gains a Food line for today, quiet, under the
composer. It lists the `Ate:` bullets from today's blocks, newest
last, and counts them. It is a reading of the note, not a second store.
Do not build calories, macros or portions yet.

A `[[name]]` inside a food line is a reference link. Tapping it opens a
read-only preview of `References/<name>.md`, or says the note is
missing. The link is the same convention Obsidian uses.

## Acceptance

- [ ] A food entry sent from the composer appears as `Ate: ` under the
      current time, and survives a re-read.
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
