---
id: 0091
title: Reference notes on a task
created: 2026-11-11
priority: normal
assignee:
pr:
depends: [0083]
---

## Spec

The operator wants a task to point at a note in `References/`. The
example is a groceries item that links to an existing food note. That
way, a reader can open the item and the note together.

### The link

Store it in the task body, under a `## Reference` heading, as the
vault's own wikilink:

```markdown
## Reference

[[oatmeal]]
```

No schema change and no contracts release. Obsidian renders the link.
The app parses the section and shows it on the row and in the editor.
Detach removes the heading and its links. A task with no section stays
unchanged.

Trade-off: the link is not in frontmatter, so a future query across all
references has to parse the body. That is acceptable while the app is
the only reader. Record it in an ADR if the alternative comes up again.

### The picker

The editor gets a Reference field. The capture sheet, when the target
is a list, offers Link a reference after the title. The picker:

- Lists `References/*.md` from the granted root.
- Fuzzy matches the file name and the `ingredients` frontmatter. As a
  result, `egg` finds `chinese-steamed-eggs` and `miso-soup`.
- Shows the note name, its `categories` and its `types`.
- Has a file select fallback, for a finger that does not want to type.
  It opens the References folder as a list.
- Attaches one or more links. A second attach adds a line.

The picker reads the same adapter as the vault. It has its own query,
cached until the folder changes.

### Reading a reference

A tap on an attached link opens a read-only sheet with the note text.
The sheet reuses the overlay host, the focus rules and the press
policy. A missing note says so and offers to detach.

## Acceptance

- [ ] A fuzzy search finds a note by name and by ingredient, and the
      result names the note it will attach.
- [ ] Attach writes `## Reference` and the link. Detach removes them.
      The rest of the note stays unchanged.
- [ ] The link renders in Obsidian as a working wikilink.
- [ ] The row and the editor show the link after a re-read.
- [ ] The preview sheet opens, returns focus and closes on back. The
      screen handles a missing note.
- [ ] 44pt targets, named controls, TalkBack, axe clean. e2e covers
      search, attach, detach and preview.
- [ ] No change to `contracts/` and no schema release.

## Outcome

(filled in before moving to done/)
