---
title: Design a Kanban list
created: 2026-11-25
priority: normal
assignee: opencode
pr: 232
depends: []
---

## Spec

The operator's feedback on 2026-11-25: perhaps a Kanban list in Lists.
Settings adds or removes it, like the Today list. It needs a design
first, so no code ships from this ticket.

- Name what the columns are. One option is the task `status` from
  contracts ADR `20261124-deeds-are-tasks-with-a-status`. Another is
  due groups. A third is lists.
- Ticket `20261124-deed-board` already plans a board grouped by
  status. Say whether the Kanban list and the deed board are one
  surface or two.
- Show two or three designs on the real Lists screen at phone width.
  Use rendered frames, or mockups in the app's palette.
- Say how a drag between columns writes the note.

## Acceptance

- [x] Two or three designs, drawn on the real screen.
- [x] A stated relation to the deed board.
- [x] The operator picks one, or drops the idea.

## Outcome

The operator picked design A. The Kanban list and the deed board are
one surface. The status groups run down one page, as a tab on the
Lists pager. ADR `20261125-deed-board-is-the-kanban-list` records the
pick, and `20261124-deed-board` now carries the spec that builds it.

What the frames showed:

- The bottom bar cannot take a fifth tab. Its 336pt of content holds
  four nav targets and the 92pt Add pill, with 16pt to spare. A fifth
  tab needs 48pt, so it overflows by 32pt.
- B's five status chips fill 319 of 320pt. The rail fits at the
  default text size and scrolls at a larger one. It also shows one
  status at a time and drops the counts.
- C spends the pager's sideways swipe on a 288pt column and a 24pt
  peek. At four active deeds that is a full screen for four rows.

Two smaller calls, both confirmed:

- No status pill on a card. A deed's status changes by the drag or in
  the task editor's Status field. The group is the status.
- Capture on Board writes `status: "[[backlog]]"`. Without a status
  the note is a plain task, so it would land in Main instead of on
  the board.

The frames come from a throwaway branch, `design/kanban-list` at
`ee36cde`, drawn over the real Lists chrome at 360 by 800. No app code
ships from this ticket. Evidence and its proof sit in
`~/code/monkey-tasks/worktrees/evidence-kanban-design/`.

Frames:

- `~/code/monkey-tasks/worktrees/evidence-kanban-design/frames/01-a-stacked.png`
- `~/code/monkey-tasks/worktrees/evidence-kanban-design/frames/02-a-stacked-end.png`
- `~/code/monkey-tasks/worktrees/evidence-kanban-design/frames/03-a-drop.png`
- `~/code/monkey-tasks/worktrees/evidence-kanban-design/frames/04-b-rail.png`
- `~/code/monkey-tasks/worktrees/evidence-kanban-design/frames/06-c-canvas.png`
- `~/code/monkey-tasks/worktrees/evidence-kanban-design/frames/07-settings.png`

Next: build it in `20261124-deed-board`.
