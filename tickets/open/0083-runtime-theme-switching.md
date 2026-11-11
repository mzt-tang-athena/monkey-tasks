---
id: 0083
title: Switch themes at runtime on the phone
created: 2026-11-11
priority: high
assignee:
pr:
depends: []
---

## Spec

Themes are already config. `app/src/theme/tokens.ts` holds `budget`,
`todoist` and `clay`, all light. But `colors` is a module constant and
every style sheet is created at module load, so a theme can only change
by reloading the page, and only on web through `setDevTheme`. Settings
needs a real switch on the phone.

Decide the mechanism in an ADR before writing code. The shape that
fits the current code:

- A `ThemeProvider` holds the active name, persisted through
  `app/src/lib/settings.ts` (which already stores app settings outside
  the vault).
- A `useThemedStyles(makeStyles)` hook memoizes one
  `StyleSheet.create` per theme.
- A codemod turns each `const styles = StyleSheet.create({...})` into
  `const makeStyles = (colors: Palette) => StyleSheet.create({...})`
  and adds the hook call. That is the lever. Do not hand-edit 50 files.
- Screens stop importing `colors` directly. A lint rule fails a direct
  import from `features/` or `components/`.

Port at least one dark palette. `~/code/monkey-budget/main/lib/themes.ts`
has nine palettes including `lotus`, `midnight` and `flexoki-dark`, and
`~/code/monkey-budget/main/lib/theme-contrast.ts` has a contrast test.
Map colors onto the existing palette keys. Do not copy blindly. Keep
every pair at 4.5 to 1 or better. Fold the dark pair into the light
palettes' shape, so no screen branches on theme.

Constraint: a switch repaints without a reload, without losing the
current screen, the scroll position or an open sheet. No raw color
outside `theme/`.

## Acceptance

- [ ] An ADR records the mechanism, the rejected alternative and the
      contrast rule.
- [ ] A switch at runtime repaints Lists, Planner, the editor and the
      capture sheet with no reload and no state loss.
- [ ] The choice survives a restart on the phone.
- [ ] A contrast test covers every palette pair and fails below 4.5.
- [ ] Lint fails a direct `colors` import outside `theme/`, and the
      tree has none.
- [ ] axe clean on every screen in every palette. Screenshots for each
      palette.

## Outcome

(filled in before moving to done/)
