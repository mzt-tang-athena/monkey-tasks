---
id: 0054
title: Shared UI primitives
created: 2026-10-26
priority: high
assignee:
pr:
depends: [0050]
---

## Spec

The screens build menus, banners, states, chips and sheets by hand.
`src/components/ui` holds three primitives (Button, IconButton, Pill),
and only two screens use them. This ticket adds the primitives that
tickets 0055, 0056 and 0057 need, each with a component test. It moves
no feature call site except the shared task rows. The screen tickets
adopt the primitives.

Paths and line numbers cite commit `b2c0b10`. Ticket 0050 renames files
to kebab-case and moves the tree, so look for the same code under its
new name. New files take kebab-case names in `src/components/ui/`.

### Tokens

Add three groups to `src/theme/tokens.ts`.

- `layers`: one z scale for every surface that floats. Today the drag
  ghosts, menus, toast and sheet stack in tree order. One ghost sets
  `zIndex: 20` (`plannerStyles.ts:401`), and `elevation` values reorder
  the rest on Android only. Order, low to high: content, bottom bar,
  drag ghost, menu backdrop, menu, sheet scrim, sheet, toast.
- `type`: a type scale. The screens hold 86 `fontSize` literals in 11
  sizes. The eyebrow label exists in five forms (`index.tsx:1404`,
  `plannerStyles.ts:206`, `plannerStyles.ts:241`,
  `plannerStyles.ts:709`, `TaskEditorScreen.tsx:531`). Name the steps
  by role: eyebrow, caption, meta, control, body, bodyLarge, title,
  display.
- `shadows`: the floating shadow block (opacity 0.14, radius 16, offset
  8, elevation 6) repeats five times. Add `shadows.floating` and
  `shadows.lifted`.

Record the type scale and the layer order in one ADR. Both have
alternatives that a later agent could reopen.

### Primitives

| Primitive | Behaviour | Call sites it replaces later |
|---|---|---|
| `OverlayHost` | A root portal in `src/app/_layout.tsx`, around the stack. It draws overlays above every screen at their `layers` value. While a modal overlay shows, it hides the screen content from assistive tech: `importantForAccessibility="no-hide-descendants"` on Android, `aria-hidden` on web. No new dependency. | ghosts, menus, toast, sheet (0055 to 0057) |
| `Menu` | Opens from an anchor ref. Measures the anchor on open and again when the window size changes. Opens below the anchor and flips above when it would cross the bottom bar or the bottom safe area. Clamps both sides to the page gutter. The backdrop, Android back and web Escape close it. Items take a label, a hint, a selected check, a danger tone and a disabled state. Roles `menu` and `menuitem`. One width token. The entrance motion stays on today's code (`PlannerScreen.tsx:64-84`) behind a hook, for ticket 0058 to swap. | `index.tsx:807-819`, `index.tsx:982-1062`, `PlannerScreen.tsx:310-367`, `SourceToggle.tsx:59-64` |
| `Banner` | Tones danger and info. A title, lines and an optional action. Role `alert` with a polite live region. | `index.tsx:829-958`, `TaskEditorScreen.tsx:314-318` |
| `Toast` | A floating banner at `layers.toast` with up to two actions. Role `alert`. | `BottomBar.tsx:281-309` |
| `LoadingState`, `EmptyState`, `ErrorState` | Skeleton lines, a centered label, and a message with a Retry `Button`. One look for every list. | `index.tsx:1089-1105`, `PlannerStates.tsx`, `TaskEditorScreen.tsx:131-137`, `TaskListSection.tsx:116`, `ErrorBoundary.tsx:56-73` |
| `SectionHeader` | An eyebrow label, an optional count and a tone (accent, danger, muted, faint). Role `header`. | `index.tsx:579-603`, `DaySpread.tsx:609`, `DaySpread.tsx:712`, `MonthView.tsx:94-110` |
| `CardGroupRow` | One row of a group card: first, middle, last or only, with an inset divider. The inset comes from the `TaskRowFace` constants, not a literal (`index.tsx:1437`). | `index.tsx:1415-1442`, `ListPagePreview.tsx:164-190` |
| `TabStrip` | Tabs that scroll, with an underline. Scrolls the selected tab into view. Roles `tablist` and `tab`. Targets at least 44 by 44. | `index.tsx:846-886` |
| `SegmentedControl` | Label or icon segments. Squares the inner corners in one place. Targets at least 44 by 44. | `PlannerHeader.tsx:87-117`, `FormToggle.tsx` |
| `Sheet` | Scrim, dock, keyboard lift and content. Android back closes it. Modal for assistive tech through `OverlayHost`. The motion stays on today's code (`CaptureSheet.tsx:104-124`, `BottomBar.tsx:108-133`) until ticket 0062. | `CaptureSheet.tsx:126-215` |
| `TextField` | Label, hint, error and multiline. The label names the input for assistive tech. | `TaskEditorScreen.tsx:386-426` |
| `Icon` | The glyphs the app builds from views, moved into one file with a `name` prop and a color token. No icon font. | `index.tsx:896-913`, `BottomBar.tsx:342-376`, `BottomBar.tsx:476-496`, `FormToggle.tsx:39-68`, `CaptureChips.tsx:81-125`, the two grip dot sets |
| `Button` with a `text` variant | A label-only button, at least 44 high. | Cancel, Dismiss, Retry, Open in day view |

### Shared task rows

`TaskRow.tsx` and `PreviewRow.tsx` hold two copies of the same markup,
styles, `formatTime` and `startOfToday`. The planner model holds a third
`formatTime`. Extract `TaskRowFace` (the still markup and its layout
constants) into `src/components/`. `TaskRow` wraps the face with the
toggle, the open press and today's motion. `PreviewRow` renders the face
with no handlers. One `formatTime` lives in `src/utils`.

The face also fixes a bug. The meta row renders when it holds nothing,
and its `marginTop: 2` (`TaskRow.tsx:309-314`, `PreviewRow.tsx:119-124`)
adds 2pt under every single-line row. The text then has 12pt above and
14pt below, which breaks the symmetric padding of ADR 0012. Render the
meta row only when it has content.

`Pill` has a `chip` tone that nothing uses, and `CaptureChips.tsx:59-74`
copies it. Point `CaptureChips` at `Pill`.

### The wider spacing rule

ADR 0012 says a child never declares spacing outside itself. Ticket
0048 turns the `marginBottom` and `marginRight` rule into an error. Its
step 9 records a wider rule in an amendment to ADR 0012, and that rule
lands as an error here.

Extend the `no-restricted-syntax` selector in `app/eslint.config.js` to
`marginTop`, `marginLeft`, `marginVertical` and `marginHorizontal`, at
`error`. The wider selector matches about 36 sites in 10 files: the 33
that 0048 step 9 lists (`plannerStyles.ts`, `TaskEditorScreen.tsx`,
`src/app/(tabs)/index.tsx`, `src/app/dev.tsx`, `BottomBar.tsx`,
`CaptureChips.tsx`, `TaskRow.tsx`, `PreviewRow.tsx`, `PeriodStrip.tsx`,
`ListPagePreview.tsx`), plus three `marginHorizontal` bleeds
(`plannerStyles.ts:613`, `plannerStyles.ts:627`, `PeriodStrip.tsx:93`).

Fix each site by moving the gap to its parent: a `gap` on the
container, or symmetric padding inside the child. For a bleed, the
parent drops its gutter for that child, or the scroller sits outside the
padded frame. The TaskRow meta row above is one of these sites. Other
tickets rebuild some of these files later; fix the sites as they stand
now, so the rule can run as an error from this ticket on.

## Acceptance

- [ ] `tokens.ts` exports `layers`, `type` and `shadows`.
- [ ] An ADR records the type scale and the layer order.
- [ ] Each primitive in the table lives in `src/components/ui/` with a component test for its roles, names and states.
- [ ] The `Menu` test opens a menu from an anchor near the bottom edge and finds it above the anchor, inside the window.
- [ ] The `Menu` test opens a menu from an anchor at the right edge and finds its right side inside the page gutter.
- [ ] A press on the backdrop, Android back and web Escape each close an open `Menu`.
- [ ] A disabled menu item ignores a press and reports `aria-disabled`.
- [ ] Android back closes an open `Sheet`.
- [ ] While a `Sheet` shows, the test finds the screen content hidden from assistive tech.
- [ ] `Banner` and `Toast` report role `alert`.
- [ ] `TabStrip` and `SegmentedControl` targets measure at least 44 by 44.
- [ ] A test reproduces the meta row gap first. Afterwards a single-line row has equal space above and below its text.
- [ ] `TaskRow` and `PreviewRow` render through `TaskRowFace`.
- [ ] The source holds one `formatTime`.
- [ ] `CaptureChips` renders `Pill` chips and holds no chip styles of its own.
- [ ] The spacing rule in `app/eslint.config.js` covers `marginTop`, `marginLeft`, `marginVertical` and `marginHorizontal` at `error`.
- [ ] No style in `app/src` declares one of those margins, and each former site takes its gap from its parent.
- [ ] Lists, Planner (day, week and month), the editor and the capture sheet show the same spacing as before at 390 by 800, apart from the meta row fix.
- [ ] `npx eslint src --max-warnings 0`, `npx tsc --noEmit` and the test suite pass.

## Outcome

(filled in before moving to done/)
