---
title: A deed board grouped by status
created: 2026-11-24
priority: normal
assignee: opencode
pr:
depends: ["20261124-app-reads-deeds-as-tasks", "20261125-today-list"]
---

## Spec

Contracts ADR `20261124-deeds-are-tasks-with-a-status` decides that a
deed is a task with a status. ADR
`20261125-deed-board-is-the-kanban-list` decides where the board lives
and which layout it uses. This ticket builds it.

- The board is a tab on the Lists pager, named Board. Design A puts
  Active, Backlog and Someday down one page as groups. Done and
  Dropped fold at the end, like a list tab's Completed group.
- Settings has a Built-in lists section, added by
  `20261125-today-list`. Board gets a row there, and off is the
  default. The tab order is Today, Main, Board, then list notes.
- The board reads deeds: tasks with a status. Main keeps its rule,
  so the two tabs split the vault.
- Tap a deed's title to open it in the task editor.
- Change a deed's status by dragging it onto another group, or in the
  editor's Status field. A card carries no status pill, because its
  group is the status.
- Setting done writes status done and `completed` together, in one
  write. Leaving done removes `completed`. Ticking a deed does the
  same as setting done.
- Drag a deed to order it inside its group. The drag writes `order`,
  as My order does on a list tab. A due-date sort turns the drag off.
- A deed is not ready while a `blocked by` link reaches a note that
  is not done. Show it as not ready, and name the blocker. A link
  that reaches no note does not block. `vault:check` names it.
- A blocked deed still drags. Readiness only changes how it looks.
- Capture from Board writes `status: "[[backlog]]"`, so the new note
  lands in Backlog rather than in Main.
- No cap on active deeds.

The picked layout's frames:

- `~/code/monkey-tasks/worktrees/evidence-kanban-design/frames/01-a-stacked.png`
- `~/code/monkey-tasks/worktrees/evidence-kanban-design/frames/02-a-stacked-end.png`
- `~/code/monkey-tasks/worktrees/evidence-kanban-design/frames/03-a-drop.png`

The two layouts we did not take:

- `~/code/monkey-tasks/worktrees/evidence-kanban-design/frames/04-b-rail.png`
- `~/code/monkey-tasks/worktrees/evidence-kanban-design/frames/06-c-canvas.png`

Prove it with the `verify-monkey-tasks` skill, on the web preview and
on the Android emulator.

## Acceptance

- [ ] The board shows active, backlog and someday groups in order.
- [ ] Done and Dropped fold at the end.
- [ ] A status change shows at once and lands in the note.
- [ ] Setting done writes `completed`. Leaving done removes it.
- [ ] A drag keeps its place after a reload.
- [ ] A deed blocked by an open note shows as not ready.
- [ ] Capture on Board writes status backlog.
- [ ] Settings removes and restores the Board tab, and it persists.
- [ ] The board passes the gallery's touch target and axe checks.

## Outcome

(filled in before moving to done/)
