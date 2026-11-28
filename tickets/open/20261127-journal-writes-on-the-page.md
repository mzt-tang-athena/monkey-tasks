---
title: The Journal writes on the page
created: 2026-11-27
priority: normal
assignee:
pr:
depends: [20261126-journal-tap-to-write]
---

## Spec

Build the writing half of ADR `20261127-journal-tap-to-write`.

- A tap on the blank rules opens a new bottom line.
- The rail shows the live clock until the first keystroke fixes it.
- Return adds a bullet under the same time, and saves the line.
- The keyboard going down ends the session and saves the rest.
- A tap on an older line edits it in place.
- Emptying a line deletes it. An empty block loses its time.
- Writes rewrite only the touched lines. The change check guards them.
- The sheet, the Food chip and the bar's sheet clock go away.

`planAppend` grows into a line edit plan. Test every edit rule as pure
functions in `lib/journal/format.ts` first.

## Acceptance

- [ ] Tap, type, Return, keyboard down: one block lands.
- [ ] A tap with no typing writes nothing.
- [ ] Editing and emptying an older line rewrite only that line.
- [ ] A note changed in Obsidian stops the write and keeps the text.
- [ ] Emulator frames with the real keyboard up.

## Outcome

(filled in before moving to done/)
