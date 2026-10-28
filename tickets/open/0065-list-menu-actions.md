---
id: 0065
title: List menu actions rename, delete and clear completed
created: 2026-10-26
priority: low
assignee:
pr:
depends: [0052, 0055]
---

## Spec

The Lists overflow menu showed Rename list, Delete list and Delete all
completed tasks, and none of them did anything
(`src/app/(tabs)/index.tsx:1022-1047` at commit `b2c0b10`). Ticket 0055
hid them. This ticket builds the three actions through the mutation
layer from ticket 0052 and shows the items again.

A list is a note with `kind: "[[lists]]"` in the vault's `Tasks/Lists/`
folder. Its file name is the tab name (`features/lists/query.ts:28-47`).
A task joins a list through a `[[Name]]` entry in its `lists` property.

### Rename list

- Show the item on list tabs only. Main is not a list note.
- Ask for the new name in a `Sheet` with a `TextField`. Refuse an empty
  name, a name that `safeFileName` changes, and a name that another list
  already uses. Each refusal shows a message under the field.
- SAF has no rename call. Write the new note with the old text, then
  delete the old note. The editor's rename takes the same path
  (`TaskEditorScreen.tsx:29-46`). Obsidian sees a delete and a create,
  so links to the old name elsewhere in the vault do not follow. Warn
  once per session, as the editor does.
- Rewrite `[[Old]]` to `[[New]]` in the `lists` property of every task
  on the list.
- The tab keeps its place and stays selected under the new name.

### Delete list

- Show the item on list tabs only.
- Ask first: "Delete the list Focus? Its 4 tasks stay in Main." The
  delete button uses the danger tone.
- Remove `[[Name]]` from the `lists` property of every task on the list,
  then delete the list note.
- The screen moves to Main.

### Delete all completed tasks

- Act on the completed tasks that the current tab shows. Hide the item
  when the tab shows no completed task.
- Ask first, with the count: "Delete 7 completed tasks? This removes
  their notes from the vault."
- A completed recurring occurrence is history, and the next occurrence
  links to it through `recurrence previous` (ADR 0027). The delete ADR
  below decides what happens to those links.

### Shared rules

- Each action is a `useMutation` hook in `src/stores/tasks`, with an
  optimistic update and a rollback on failure, in the same shape as the
  0052 writes.
- A partial failure, for example 3 of 7 deletes, shows the failed count
  in a `Banner` and keeps the writes that worked. The store then reads
  the vault again.
- Write an ADR for how a delete leaves the vault: remove the file, or
  move it to Obsidian's `.trash/` folder so the user can restore it. The
  same ADR covers the `recurrence previous` links.

## Acceptance

- [ ] An ADR records how a delete leaves the vault and what happens to `recurrence previous` links.
- [ ] The overflow menu shows all three items again.
- [ ] Rename list and Delete list show on list tabs only.
- [ ] Delete all completed tasks shows only when the tab shows a completed task.
- [ ] Rename refuses an empty name, a name that `safeFileName` changes and a name in use, each with a message.
- [ ] After a rename, the vault holds the list note under the new file name, and every member task lists `[[New]]`.
- [ ] After a rename, the tab shows the new name in the same place and stays selected.
- [ ] After a list delete, the vault no longer holds the list note, and no task lists `[[Name]]`.
- [ ] After a list delete, the former members show in Main, and the screen shows Main.
- [ ] Delete all completed tasks removes the completed tasks that the tab showed and leaves every open task.
- [ ] Each action asks first, and Cancel changes nothing.
- [ ] A failed write rolls back the optimistic change and shows a `Banner` with the failed count.
- [ ] Mutation tests run against the vault adapter fake from ticket 0051.
- [ ] A Playwright test runs rename, list delete and clear completed on the web mock vault.
- [ ] `npx eslint src`, `npx tsc --noEmit`, the test suite and the Playwright suite pass.

## Outcome

(filled in before moving to done/)
