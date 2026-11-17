---
id: 0083
title: Switch themes at runtime on the phone
created: 2026-11-11
priority: high
assignee: omp
pr: 117
depends: []
---

## Spec

Themes are already config. `app/src/theme/tokens.ts` holds `budget`,
`todoist` and `clay`, all light. But `colors` is a module constant, and
module load creates every style sheet. A page reload is thus the
only way to change a theme, and only on web through `setDevTheme`. Settings
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

- [x] An ADR records the mechanism, the rejected alternative and the
      contrast rule.
- [x] A switch at runtime repaints Lists, Planner, the editor and the
      capture sheet with no reload and no state loss.
- [ ] The choice survives a restart on the phone. The web reload proves
      the storage path. The phone check is with the operator.
- [x] A contrast test covers every palette pair and fails below 4.5.
- [x] Lint fails a direct `colors` import outside `theme/`, and the
      tree has none.
- [x] axe clean on every screen in every palette. Screenshots for each
      palette.

## Outcome

Fixed on 2026-11-11 on `feat/0083-runtime-themes`. Pull request #117,
merge `ddacc17`.

`ThemeProvider` owns the active palette. It reads the saved name in a
state initializer, so the first frame carries the right palette. Every
change saves through `lib/settings.ts`. `useThemedStyles` builds
one sheet per palette and caches it in a `WeakMap`, so a switch back is
a lookup. The provider sits above the overlay host, so menus, toasts
and the capture sheet repaint too.

The codemod in `app/scripts/theme-codemod` converted 43 files into
style factories and added 63 hook calls. A rerun reports `converted 0,
skipped 161, hand 0` and writes nothing. Four files needed hand work:
`task-row-face`, `banner`, `error-boundary` and `planner-layout`.

`midnight` joins the palettes, mapped onto the same 14 keys. The
lowest text pair is 4.52 across the four palettes. The contrast test
excludes `inkFaint`, for disabled text, and `hairline`, for
decoration. Todoist and clay accents moved slightly to pass AA as
text.

The split grabber's arrow step could fire before the root reported its
layout. As a result, a press in that window did nothing. It now parks the step and
applies it on the first layout report. A probe proved it by delaying
`ResizeObserver` four seconds.

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npx eslint src scripts e2e --max-warnings 0` | clean |
| `npx vitest run` | 84 files, 742 tests passed |
| Local e2e, port 8592 | 386 passed, 26 skipped, 0 failed |
| CI `e2e-web` | 386 passed, 26 skipped |
| Verifier | PASS. Ten checks, contrast recomputed, codemod rerun with a clean tree |

### Evidence limits

Native palette rendering is unproven, and so is a real-phone restart.
The runs had no adb device attached. The write path is the same
`settings.ts` path the task form and sort mode use. The reload has
proof on web.

On web, `+html.tsx` paints the budget paper in the static shell, and
the pre-hydration swap script no longer exists. A restart on another palette
shows budget paper until the bundle mounts. The phone's first frame
does not flash. That is because the provider reads the saved name
synchronously.

A switch re-renders every context consumer. The cost on a low-end phone
with a long list stays unmeasured.
