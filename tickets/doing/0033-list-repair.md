---
id: 0033
title: A list note that fails validation vanishes, and the tab bar has no repair state
created: 2026-10-23
priority: high
assignee: omp
pr:
depends: [0010]
---

## Spec

Reported on the phone on 2026-10-23. `Tasks/Lists/Errands.md` existed
with `kind: [[lists]]` and an empty `created:`, and no Errands tab
appeared.

Cause found on 2026-10-24. `listFrontmatter` requires `created` as an
ISO date, so the note failed validation, `parseListNote` returned null,
and the loader dropped it without a word. A valid note shows its tab
on the next vault read. The loader is fine. The bug is the silence.

`created` stays required. App-made lists always carry it, and the
vault keeps one rule for every note kind.

## Scope

- A note that fails validation is visible, never dropped.
- The tab bar gets a header treatment that survives many lists.
- Focus becomes an ordinary list note. Main shows every task.
  ADR 0015's Focus exception goes.

Out of scope: creating a list from the app. That is a command for the
command pane, in its own ticket.

## Acceptance

- [ ] A valid list note in `Tasks/Lists/` shows as a tab on the next
      vault read: foreground return or pull to refresh, no restart.
- [ ] A note that fails validation shows its file name under a
      `Needs repair` heading above the list, with one bullet per error.
      It never hides the other tabs.
- [ ] The repair block names the file so the note can be fixed in
      Obsidian.
- [ ] The tab bar scrolls horizontally when the lists outgrow the
      width, and the sort and menu buttons stay fixed and clear of the
      chips.
- [ ] The header is separated from the list body by a hairline rule on
      the surface fill, using theme tokens only.
- [ ] Focus is a tab derived from `Tasks/Lists/Focus.md` like any other
      list, and a task on Focus also appears on Main.
- [ ] The loader is tested against the device's percent-encoded
      document uri, not only a plain path.
- [ ] A list note's body is untouched by every app path, and a test
      pins it.

## Outcome

(filled in before moving to done/)
