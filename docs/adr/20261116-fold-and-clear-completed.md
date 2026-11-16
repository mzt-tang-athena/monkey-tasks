# Folded completed tasks, and a clear that deletes their notes

- **Status:** accepted
- **Date:** 2026-11-16

## Context

Done tasks took the last group on every Lists tab. The operator wants to
ship 1.0 this week and use it every day. A list full of done work buries
the open work. Nothing in the app removed old done notes.

The Lists page draws one `SectionList` per tab. It holds the dated
groups of open tasks, then one Completed group. The tick holds a ticked
row in place until its wash ends (ADR 0034). The pager draws a still
preview of the next tab. Every write goes through one mutation scope
behind the vault adapter (ADR 0037). The app has no trash and no undo.

## Decision

**Fold.** The Completed group starts folded on every tab. Its header
keeps the count. It becomes a 44pt disclosure button with
`aria-expanded`, and a tap opens or closes the group. The chevron turns
on the shared `useProgress` clock over `motion.ms.settle`. The rows
change with the data, because they live in a virtualized `SectionList`.

The fold is view state, kept per tab in a module store. It does not
survive a restart. The fold runs after the tick hold and the reorder
read the full groups. Neither loses its rows.

**Clear.** The list menu offers Delete all completed tasks when the tab
has a done task. It hides the item when the tab has none. The
item opens a `Sheet` that names the count and keeps Cancel first, so
the safe action holds the focus. The confirm deletes one note per task
through the mutation layer. A note that stays comes back, and the
notice names how many stayed. When every delete fails, the write fails
and the failure banner offers Retry. A finished clear reads the vault
again.

**Delete behaviour.** The app removes the note through the SAF adapter,
which calls `FileSystem.deleteAsync`. The file leaves the vault folder
and the app keeps no trash copy. The app moves no note to a trash
folder. Obsidian's trash settings apply to files Obsidian deletes.
Obsidian sees a delete and syncs it to the other devices. A concurrent
edit on another device can still win a sync conflict, and the app
cannot recover that note. The mutation layer rolls back a failed write
only, and keeps no history of a write that landed. This ticket builds
no undo. Undo would replay `create` with the same file name and text
from a kept snapshot.

We rejected three alternatives:

- **Persist the open state per tab.** A user who opened Completed once
  would then get an open group on every start. The default would change
  without a control that says so. It also needs one settings key per
  tab, or one key with a tab list.
- **Move a deleted note to `.trash/`.** The app owns no trash. The
  vault check and Obsidian would still read a hidden folder.
- **Clear every tab's done tasks.** A destructive action would then
  reach lists the user is not looking at. The confirmation could not
  name what it touches.

## Consequences

The page is shorter, and the open work comes first. A done task leaves
the page after its wash instead of joining a visible group. A user who
wants to see or clear done work opens the group first.

The clear deletes files for good. Its confirmation names the count, and
the menu hides the action when there is nothing to delete. A partial
failure leaves the vault and the list consistent. The notes that stayed
are still rows.

The chevron is the only motion. A height animation would need the rows
out of the `SectionList`. That would break the tick hold, the reorder
and the still preview.

## Amendment, 2026-11-16: the delete reads each note again

The confirmation freezes its set when the sheet opens. Another app can
reopen a note while the sheet is up. A verifier did that and the app
deleted the reopened note.

The delete now reads each note again before it removes it. It deletes a
note only when the note still parses as completed. A note that is
missing, unreadable or reopened stays. The notice names how many stayed
and why the first one did.

A read that fails does not count as a failed delete. If every note in
the set came back open, the clear ends in a notice and offers no
retry.

The adapter has no conditional delete. A window remains between the
read and the remove call. ADR 0035 records the same read-then-act
window for `writeNoteIfUnchanged`. A second writer can still land in
it. Closing the window needs a compare-and-delete in the vault
adapter. Neither platform offers one today.

## Amendment, 2026-11-16: a cleared occurrence can leave a broken link

A recurring task's next note carries `recurrence previous`, a link to
the note that made it. A clear can delete that earlier note. The link
then points at a file the vault no longer holds.

We accept the broken link. The app never reads the link target. It only
checks that the property exists, to hide the next occurrence until its
due day. The untick path that reads the earlier note leaves with that
note. Obsidian draws the link as unresolved, and the vault loses no
data.

We do not rewrite the next note. That would be a write the user did not
ask for, and it can race another app. The next note keeps its row, its
date and its link text.
