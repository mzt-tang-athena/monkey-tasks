# 0012. Spacing ownership rule

- **Status:** accepted (design)
- **Date:** 2026-10-21

## Context

Extra space kept appearing in rows and panels. Each component pushed
its own bottom and right margins. The last item in a container
collected a stray gap. Two children sometimes claimed the same gap.
The result needed one critique round per bug to find.

## Decision

The container owns the gaps between its children. Children never
declare spacing outside themselves. Containers space children with
one gap value from the spacing tokens. Internal padding stays
symmetric, equal on both sides. Text flows use the same rule.

## Consequences

Rows, cards, and panels get space from one place: their container.
Removing a child never leaves a hole. Symmetric padding keeps text
centered, which is what the row critiques kept asking for. An ESLint
rule warns when a child declares a bottom or right margin; it becomes
an error after the cleanup pass. Prettier only formats text, so it
cannot enforce this; the rule lives in ESLint.

## Amendment, 2026-10-27: the rule is an error, and it grows

Ticket 0048 ran the cleanup pass. No child declares a bottom or right
margin now, and the ESLint rule runs at `error`. Any ESLint warning
fails the pre-commit hook, and CI gets the same limit in ticket 0068. A
warning that CI ignores goes unread, as ADR 0026 found with Vale.

The rule covers every margin a child sets outside itself:
`marginTop`, `marginLeft`, `marginVertical` and `marginHorizontal` as
well. After 0048 the wider selector matches 30 top, left and vertical
sites in 10 files, and 2 horizontal bleeds. Phase 3 of 0047 rebuilds
most of those files. Ticket 0054 widens the selector at `error` and
clears these sites. We add no `warn` level in between, for the reason
above.

A `FlatList` cannot put a gap between its header slot and its first
row. The list owns that space and sets it on the slot with
`ListHeaderComponentStyle` (see `TaskListSection.tsx`). This is the one
place a container uses padding on one side only. A child still sets
no spacing outside itself.

## Amendment, 2026-10-28: every margin is an error

Ticket 0054 widened the rule. The selector now matches every margin
property, on any side and in either key form, at `error`. It cleared
the 32 sites the last amendment counted. Each gap moved to its parent
in one of three ways:

- A `gap` on the container. Most sites took this.
- A slot with symmetric padding, where a rule or a group of lines sat
  between two blocks: the week column's rule, the skeleton lines.
- A frame with no gutter, for a scroller that runs to the screen's
  edges. The week and month frame drops its side padding, and each
  block in it takes the gutter itself. The period rail and the week
  canvas then reach the edges with no negative margin.

A list has two more slots of its own, like the `FlatList` header slot
above. A `SectionList` has no gap between its sections, so the Lists
screen pads the top of each section header it renders. A `FlatList`
footer sits a step under the rows through `ListFooterComponentStyle`.
In both, the list sets the space on a slot it owns.
