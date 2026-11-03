---
id: 0057
title: The capture dock leaves the bottom bar, and the editor splits
created: 2026-10-26
priority: high
assignee: claude-code
pr: 80
depends: [0054]
---

## Spec

This ticket makes two moves and fixes three bugs. Each bug gets a
failing test before its fix.

Paths and line numbers cite commit `b2c0b10`. Ticket 0050 renames files
to kebab-case, so look for the same code under its new name.

### Capture dock

`src/components/BottomBar.tsx` (557 lines) is shared UI, but it imports
the capture feature at runtime (`BottomBar.tsx:14-15`). It also owns the
capture sheet's open state, its animation clock and the failure toast
(`BottomBar.tsx:56-176`). The target layout forbids that edge:
`src/components` never imports `src/features`, and no feature imports
another. Routes compose features.

| File | Holds | Code today |
|---|---|---|
| `src/components/bottom-bar/bottom-bar.tsx` | The shell: nav tabs on the left, an `action` slot on the right, and a collapse value that the slot drives. No feature imports. | `BottomBar.tsx:178-275` |
| `src/components/bottom-bar/nav-tab.tsx` | `IconTab`, with its glyphs from `Icon` | `BottomBar.tsx:314-376` |
| `src/features/capture/hooks/use-capture-sheet.ts` | Open and mounted state, the expand and bar values, failure, retry and dismiss | `BottomBar.tsx:56-176` |
| `src/features/capture/components/capture-dock.tsx` | The Add button, the sheet on `Sheet`, and the failure `Toast` | `BottomBar.tsx:258-272`, `BottomBar.tsx:281-309`, `CaptureSheet.tsx` |

The two tab routes pass the dock into their screens as a slot. The
screen hands the slot its capture targets, its default target and its
default due day. The dock sends through the capture mutation from
ticket 0052. This ticket edits `src/app/(tabs)/index.tsx` and
`src/app/(tabs)/planner.tsx`, which tickets 0055 and 0056 also touch.
Rebase on the integration branch after they merge.

The motion stays on today's code inside `use-capture-sheet`
(`BottomBar.tsx:79-133`). Ticket 0062 then puts the sheet and the bar on
one clock without a change to the shell.

### Task editor

`TaskEditorScreen.tsx` (584 lines) holds the route lookup, two headers,
a form, a note viewer, a field and nine helpers.

| File | Holds | Code today |
|---|---|---|
| `task-editor-screen.tsx` | The lookup and the switch between form and viewer | `TaskEditorScreen.tsx:115-148` |
| `components/editor-header.tsx` | Cancel as a `text` Button, Save as a solid Button | `TaskEditorScreen.tsx:151-191` |
| `components/task-editor-form.tsx` | The form, with `TextField` | `TaskEditorScreen.tsx:243-426` |
| `components/note-viewer.tsx` | The read-only view of a note that is not a task | `TaskEditorScreen.tsx:212-241` |
| `hooks/use-task-editor-draft.ts` | Draft, list text, reminder text, save and the rename warning | `TaskEditorScreen.tsx:35-46`, `TaskEditorScreen.tsx:245-299` |
| `lib/draft.ts` | `draftOf`, `listName`, `parseLists`, `parseReminders`, `decode`, `findTask`, `isTaskNote` and `frontmatterEntries` as pure functions | `TaskEditorScreen.tsx:49-113`, `TaskEditorScreen.tsx:199-205` |

The editor saves through the edit mutation from ticket 0052.

### Bugs

1. **The capture sheet does not act as a modal.** The app registers no
   `BackHandler` anywhere. To reproduce on Android, open capture and
   press back. The screen navigates, or the app closes, with the sheet
   still open. With TalkBack on, focus moves to the content under the
   scrim. The target pill reads "target list" (`CaptureSheet.tsx:194-198`)
   and never says which target it holds. Use the `Sheet` primitive, and
   name the pill with its current target.
2. **The keyboard covers the editor.** The form scrolls in a plain
   `ScrollView` (`TaskEditorScreen.tsx:308-313`). Android runs edge to
   edge and never resizes the window for the keyboard (ADR 0014). To
   reproduce on the phone, open a task and tap Body. The keyboard covers
   Body and Reminders, and the view cannot scroll them up. Use
   `KeyboardAwareScrollView` from `react-native-keyboard-controller`,
   which the app already ships.
3. **The floating chrome ignores the width cap.** ADR 0010 caps content
   at 720. The bar row (`BottomBar.tsx:392-398`), the sheet dock
   (`CaptureSheet.tsx:236-240`), the toast (`BottomBar.tsx:507-511`) and
   the editor header (`TaskEditorScreen.tsx:433-439`) span the window.
   To reproduce at 1280 by 800, open Lists. The Lists tab and the Add
   button sit at the far edges, while the list sits in a 720 column. Cap
   them at `measure`, and keep the bar's surface full width.

## Acceptance

- [x] No file under `src/components` imports from `src/features`.
- [x] The import boundary rule in `app/eslint.config.js` runs at `error`, and `npx eslint src` passes.
- [x] The tab routes pass the capture dock to their screens, and neither screen imports the capture feature.
- [x] A test reproduces the back bug first. Afterwards, with the sheet open, Android back closes the sheet and the screen stays.
- [x] While the sheet shows, assistive tech cannot reach the screen content under it.
- [x] The target pill's accessible name holds the current target.
- [x] A test with the keyboard controller mock reproduces the editor bug first. Afterwards the form renders in `KeyboardAwareScrollView`.
- [ ] The epic's phone pass confirms that Body stays above the keyboard. jsdom has no keyboard to check it.
- [x] `lib/draft.ts` has unit tests for every helper.
- [x] A Playwright test at 1280 by 800 reproduces the width bug first. Afterwards the bar row, the sheet, the toast and the editor header sit inside the 720 column.
- [x] Capture still opens, sends and closes.
- [x] A failed capture still shows the toast, and Retry sends the same draft again.
- [x] Save, Cancel and the rename warning in the editor still work.
- [x] `npx tsc --noEmit`, the test suite and the Playwright suite pass.

## Outcome

The capture dock left the bottom bar, and the editor split. Bugs 1 to 3
each have a test that failed first.

What landed:

- `components/bottom-bar/` is the shell, with an `action` slot and a
  `useBar` hook for the bar height and lift. It imports no feature.
- `features/capture/` holds `capture-dock.tsx`, `capture-form.tsx` and
  `hooks/use-capture-sheet.ts`. The motion is today's code, so ticket
  0062 can change it without a change to the shell.
- The tab routes pass the dock into their screens. The Lists screen
  moved to `features/lists/lists-screen.tsx` for this, because the route
  held it. ADR 0039 has an amendment with the design and the rejected
  alternative.
- The editor split into the six files of the spec. The form scrolls in
  `KeyboardAwareScrollView`.
- Bug 1: the sheet runs on `Sheet`, so back and Escape close it and the
  screen under it is hidden from assistive tech. The pill reads
  `target list: <target>`.
- Bug 3: the bar row, the sheet, the toast and the editor header hold to
  the 720 measure. The bar surface spans the window.
- Toast scope: the overlay host sits above the whole stack, so the
  toast drew over the editor and over the other tab. The dock now draws
  the toast only while its tab is focused (`useIsFocused`). The draft
  and the toast state stay, so the toast returns with the tab. A
  component test and an e2e test cover it: fail a capture, open a task,
  and find no alert.
- Menu fix from the 0054 review: `Menu` resets its box and height when
  it closes.
- Tests: `capture-dock.test.tsx`, `draft.test.ts`, the keyboard test, the
  menu reopen test, and `e2e/specs/capture-dock.spec.ts`.

Left:

- The phone check that Body stays above the keyboard. jsdom has no
  keyboard. The epic's phone pass owns it.
- The editor Name field is now named by its label, `Name`, and no longer
  by its placeholder. `e2e/specs/tasks.spec.ts` follows.
- On a wide window the sheet and toast edges sit 20 px outside the card
  edges, because the sheet gutter is `spacing.m` and the page gutter is
  `pageGutter`. Ticket 0063 can unify them.
- Ticket 0055 moves the same Lists code. Whichever PR merges second
  resolves the move.
