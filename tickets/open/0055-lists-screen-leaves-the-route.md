---
id: 0055
title: The Lists screen leaves the route
created: 2026-10-26
priority: high
assignee:
pr:
depends: [0054]
---

## Spec

`src/app/(tabs)/index.tsx` holds the whole Lists screen in 1,479 lines:
tab state, sections, the tick hold, the manual reorder, two menus, three
notices and all the styles. ADR 0022 says a route re-exports its screen.
Move the screen into `src/features/lists/` and split it into hooks and
components. Fix the six bugs below on the way. Each bug gets a failing
test before its fix.

Paths and line numbers cite commit `b2c0b10`. Ticket 0050 renames files
to kebab-case, so look for the same code under its new name.

### Target files in `src/features/lists/`

| File | Holds | Code today |
|---|---|---|
| `lists-screen.tsx` | Composition only: store reads, hooks, layout | `index.tsx:53-1076` |
| `hooks/use-list-tabs.ts` | Selected tab, tabs ref, capture targets, default target, pager `canGo` and `onPage` | `index.tsx:59`, `index.tsx:82-127`, `index.tsx:704-732` |
| `hooks/use-list-sections.ts` | Repairs, visible tasks, open and completed sections with stable keys | `index.tsx:149-178` |
| `hooks/use-tick-hold.ts` | The hold state and its timer | `index.tsx:180-198`, `index.tsx:511-549` |
| `lib/tick-hold.ts` | The section splice as a pure function | `index.tsx:200-262` |
| `hooks/use-row-reorder.ts` | Pending press, lifted row, ghost value, row shifts, settling, drop write, preview index | `index.tsx:264-577` |
| `hooks/use-sort-mode.ts` | Sort mode and its saved setting | `index.tsx:60-62`, `index.tsx:996-999` |
| `components/lists-toolbar.tsx` | `TabStrip`, the sort and overflow buttons, both menus on `Menu` | `index.tsx:846-916`, `index.tsx:980-1062` |
| `components/list-notices.tsx` | Vault prompt, repair notice and write error on `Banner` | `index.tsx:829-845`, `index.tsx:917-958` |
| `components/task-card-row.tsx` | One memoized row: `CardGroupRow`, `ReorderRow`, `TaskRow` and the grip | `index.tsx:605-699` |
| `components/reorder-ghost.tsx` | The floating row, through `OverlayHost` | `index.tsx:961-978` |

`ListPagePreview.tsx:132-190` copies the group and card styles. Point it
at `SectionHeader`, `CardGroupRow` and `TaskRowFace`.

The route becomes one line:
`export { default } from "@/features/lists/lists-screen";`. Ticket 0057
later turns it into a composition that passes the capture dock.

The motion stays on today's code. Keep it behind `use-row-reorder`,
`use-tick-hold` and the `useSwipePager` call, so tickets 0059 and 0060
can swap the internals without touching the screen. Writes go through
the mutation hooks that ticket 0052 leaves in `src/stores/tasks`. Add no
direct vault write.

### Bugs

1. **The menu backdrop sits under the body.** `index.tsx:807-825`
   renders the backdrop before the body, so the body draws and takes
   touches above it. To reproduce, open the list menu (the dots) and tap
   a task row. The editor opens. Go back, and the menu still shows. Fix
   it with `Menu` from ticket 0054.
2. **Three menu items do nothing.** Rename list, Delete list and Delete
   all completed tasks (`index.tsx:1022-1047`) close the menu and stop.
   Two of them use the danger color, so a user can think a delete ran.
   They also show on Main, which is not a list note. Hide all three.
   Ticket 0065 builds them.
3. **The top chrome breaks on wide screens.** The status strip spans the
   window (`index.tsx:806`), but the tab bar caps its surface and
   hairline at 720 (`index.tsx:1131-1145`). At 1280 by 800 the top
   chrome reads as an L shape. Let the surface band and its hairline
   span the window, and cap only the content at `measure`. Ticket 0057
   owns the bottom bar, the sheet and the toast.
4. **The row memo never holds.** `renderItem` builds new `onToggle`,
   `onOpen`, `onHold` and `onPickup` closures for each row
   (`index.tsx:642-683`). Its dependencies include `toggle`, `reorder`
   and `previewIndex` (`index.tsx:687-698`), and `toggle` depends on
   `tickHold` (`index.tsx:548`). One tick re-renders every visible row
   twice: once when the hold starts and once when it ends. Each slot
   crossing in a drag re-renders every row. Pass stable callbacks that
   take the task, and let `task-card-row` compare its own props.
5. **Rows below a changed group remount.** The sections carry no `key`
   (`index.tsx:200-262`). `SectionList` then keys each row by its
   section index. When a group above appears or leaves, every row below
   gets a new key and remounts. To reproduce, tick the only task of the
   first group. After the hold, the rows of the later groups remount and
   replay their entrance. Give each section a stable key from its group.
6. **A swipe that starts on a row opens the editor.** On web, press a
   row body, drag sideways past the swipe threshold (80px,
   `lib/swipe.ts:16`) and release. The tab changes, and the editor also
   opens for that row. The press guard (`index.tsx:315`,
   `index.tsx:476-479`) arms after a reorder drop only, never after a
   swipe. Arm the guard when the swipe controller passes its slop, and
   let row presses read it. Put the guard in
   `src/hooks/use-press-guard.ts`, so the planner can use it too.
   Ticket 0049 found this as B1. Its test in
   `app/e2e/specs/lists.spec.ts` reproduces it and carries a
   `test.fail()` mark in the motion project only: with reduced motion
   the page turns at pointer up, so the click finds no row. Remove the
   mark with the fix.

## Acceptance

- [ ] `src/app/(tabs)/index.tsx` re-exports the screen and holds no other code.
- [ ] The files in the table exist.
- [ ] `lists-screen.tsx` holds no styles for menus, notices, states or cards.
- [ ] `lib/tick-hold.ts` has unit tests for a held row in its own group, in a group that left, and with no hold.
- [ ] A test reproduces the backdrop bug first. Afterwards, with a menu open, a tap on a row closes the menu and opens no editor.
- [ ] The overflow menu shows no Rename list, Delete list or Delete all completed tasks item.
- [ ] A Playwright test at 1280 by 800 reproduces the chrome bug first. Afterwards the top surface band has one width from edge to edge.
- [ ] A render-count test reproduces the memo bug first. Afterwards a tick re-renders the ticked row only.
- [ ] During a reorder, a slot crossing re-renders only the rows whose first, last or divider state changes.
- [ ] A test reproduces the remount bug first. Afterwards a group that leaves remounts no row in a later group.
- [ ] A Playwright test reproduces the swipe bug first. Afterwards a sideways swipe that starts on a row changes the tab and opens no editor.
- [ ] A tap on a row still opens the editor.
- [ ] A tick still holds its row in place for one beat before it moves to Completed.
- [ ] A drag in My order still writes the new order.
- [ ] `ListPagePreview` renders through `SectionHeader`, `CardGroupRow` and `TaskRowFace`.
- [ ] `npx eslint src`, `npx tsc --noEmit`, the test suite and the Playwright suite pass.

## Outcome

(filled in before moving to done/)
