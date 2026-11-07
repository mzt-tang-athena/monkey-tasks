# 0043. The Lists screen is hooks, and a press guard blocks a swipe's click

- **Status:** accepted
- **Date:** 2026-11-04

## Context

The Lists route held the whole screen in one 1,427 line file. One tick
re-rendered every row twice. Rows below a vanished group remounted. A
mouse swipe that started on a row also opened that row. The repair
notice sat fixed above the list and took a fifth of the phone screen.

## Decision

The screen moves to `src/features/lists/` and splits into hooks and
components (ADR 0022). Four choices came with it.

1. **Row callbacks have one identity.** The screen hands every row the
   same callbacks for its whole life. Each callback takes the task and
   the group key, never an index. An index changes for every row below
   a row that leaves, and that would re-render them all. The rows use
   the default shallow compare of `React.memo`. We rejected a custom
   compare function, because it hides a prop that someone forgot to
   keep stable.
2. **A group's key is its title.** `SectionList` keys each row from its
   section key. A title such as "Today" or "Fri, 30 Oct" names the
   group for the whole session, so a row keeps its mount when a group
   above it comes or goes.
3. **One press guard serves every gesture.** `usePressGuard` in
   `src/hooks/` arms when a gesture passes its slop and releases when
   it ends. A press that follows the release is blocked once. The swipe
   controller reports both moments to the pager, and the reorder drop
   arms the same guard. We rejected a guard inside `TaskRow`, because
   the planner needs the same rule and `TaskRow` does not know the
   gesture.
4. **The repair notice is the list's header.** It scrolls away with the
   list and takes no fixed room. We rejected a folded one-line notice
   with a details sheet. That needs a new surface for a rare case.

The overflow menu shows only Diagnostics until ticket 0065 builds Rename
list, Delete list and Delete all completed tasks. A menu item that does
nothing is worse than no item.

## Consequences

A tick re-renders the ticked row only. A slot crossing in a drag
re-renders only the rows whose corners or divider change. A swipe never
opens a row. A user who scrolls past the repair notice no longer sees it,
and finds it again at the top of the list.

The tab strip fades an edge where more tabs wait. The fade is a stepped
set of views, because the app has no gradient library. It paints the
surface color, so the strip belongs on a surface.
