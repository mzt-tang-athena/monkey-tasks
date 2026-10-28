---
id: 0057
title: The capture dock leaves the bottom bar, and the editor splits
created: 2026-10-26
priority: high
assignee:
pr:
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

- [ ] No file under `src/components` imports from `src/features`.
- [ ] The import boundary rule in `app/eslint.config.js` runs at `error`, and `npx eslint src` passes.
- [ ] The tab routes pass the capture dock to their screens, and neither screen imports the capture feature.
- [ ] A test reproduces the back bug first. Afterwards, with the sheet open, Android back closes the sheet and the screen stays.
- [ ] While the sheet shows, assistive tech cannot reach the screen content under it.
- [ ] The target pill's accessible name holds the current target.
- [ ] A test with the keyboard controller mock reproduces the editor bug first. Afterwards the form renders in `KeyboardAwareScrollView`.
- [ ] The epic's phone pass confirms that Body stays above the keyboard. jsdom has no keyboard to check it.
- [ ] `lib/draft.ts` has unit tests for every helper.
- [ ] A Playwright test at 1280 by 800 reproduces the width bug first. Afterwards the bar row, the sheet, the toast and the editor header sit inside the 720 column.
- [ ] Capture still opens, sends and closes.
- [ ] A failed capture still shows the toast, and Retry sends the same draft again.
- [ ] Save, Cancel and the rename warning in the editor still work.
- [ ] `npx tsc --noEmit`, the test suite and the Playwright suite pass.

## Outcome

(filled in before moving to done/)
