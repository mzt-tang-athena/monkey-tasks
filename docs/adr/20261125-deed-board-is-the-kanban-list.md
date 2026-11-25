# The deed board is the Kanban list

- **Status:** accepted
- **Date:** 2026-11-25

## Context

Contracts ADR `20261124-deeds-are-tasks-with-a-status` makes a deed a
task with a status. Ticket `20261124-deed-board` plans a board grouped
by status and leaves its entry point open. The two plain options were a
fifth tab on the bottom bar and a tab on the Lists pager.

On 2026-11-25 the operator asked for a Kanban list in Lists, which
Settings can add or remove. Ticket `20261125-kanban-list-design` drew
three layouts at 360pt over the real Lists chrome. The frames sit in
`~/code/monkey-tasks/worktrees/evidence-kanban-design/`.

The operator picked one of the three and confirmed both smaller calls
below.

## Decision

The Kanban list and the deed board are one surface. Design A puts the
status groups down one page, as a tab on the Lists pager.

- The tab reads Board, and it sits after Main.
- The tab order is Today, Main, Board, then the list notes.
- Settings has a Built-in lists section. Board has a row there, and
  off is the default.
- The columns are status groups: Active, Backlog and Someday.
- Done and Dropped fold at the end, as a list tab's Completed does.
- A drag inside a group writes `order`.
- A drag across groups writes `status` and `order` in one note write.
  A drop into Done writes `completed` in that same write. A drop out of
  Done removes it.
- A card carries no status pill. The group is the status. The other
  paths are the drag and the task editor's Status field.
- Capture on Board writes `status: "[[backlog]]"`. Main hides a status,
  so a capture with no status would vanish from every list.

### Why one surface

- Both read the same deeds and group them by the same status.
- Two surfaces would carry two drop paths and two drag test sets.
- The deed board ticket's own spec already describes design A.

### Why a Lists tab, not a bar tab

The bottom bar has no room. Measured on the 360pt frame:

- The bar holds 336pt of content after its 12pt side padding.
- Four nav targets take 188pt, and the Add pill takes 92pt.
- That leaves 16pt of slack.
- A fifth tab needs 48pt with its gap, so the bar overflows by 32pt.

A pager tab also keeps the bar's shape when Settings removes the board.

### Options we rejected

- **B, a status rail over one column.** Five chips measure 319 of
  320pt. The rail fits with 21pt to spare, and scrolls at a larger
  text size. It shows one status at a time and drops the counts. B is
  design A plus a control that A does not need.
- **C, a column canvas.** Columns of 288pt with a 24pt peek of the
  next. That puts a horizontal canvas inside a horizontal pager, so
  the pager's swipe stops on this page. It spends the app's one
  sideways gesture to show four cards on a full screen.
- **A fifth bottom-bar tab.** It overflows the bar by 32pt. A bar tab
  that Settings can remove also changes the primary navigation's
  shape.

### The trade-off

A phone at 360pt cannot show two readable columns. A is a board read
down the page. An operator who wants the Trello look pays for it in a
stolen swipe and wrapped names. We choose the read, the cheaper build,
and the list's own fold, reorder and tick-hold machinery.

## Consequences

- Board adds one page branch to the pager and one section list.
- Settings gains one boolean beside Today's.
- A deed's status changes by drag or in the editor. The deed board
  ticket's tap-a-status line changes with this record.
- Capture on Board creates a backlog deed. Main keeps its rule: tasks
  with a status never show there, so Main and Board split the vault.
- The board keeps the list's sort. A due-date sort turns the drag off,
  as it does on a list tab.
- The vault gains no field. The board reads `status`, `completed`,
  `order` and `blocked by`. Every one already exists.
