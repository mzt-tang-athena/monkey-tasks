# Switch themes through a provider

- **Status:** accepted
- **Date:** 2026-11-11

## Context

The app has three light palettes in `app/src/theme/tokens.ts`. Each one
is a plain object with the same 14 keys. Every screen reads the module
constant `colors`, and every style sheet runs `StyleSheet.create` once,
at module load. So the palette is baked in before the first frame.

`setDevTheme` writes a web storage key and reloads the page. That is the
only switch, and it lives on the diagnostics route. It cannot work on
the phone, and a reload throws away the screen, the scroll position and
any open sheet.

The phone needs a switch that repaints the screen in place. Ticket 0083
owns the mechanism. Ticket 0084 owns the settings screen that will show
it as a radio group.

## Decision

The active palette flows through a React context.

- `ThemeProvider` holds the active palette name. It reads the saved
  name from `lib/settings.ts` at mount, and it saves every change there.
  The provider is the one owner of the active theme.
- `useThemedStyles(makeStyles)` reads the context and returns the style
  sheets for the active palette, plus the palette itself for inline
  styles. It caches one result per factory per palette, so a switch back
  costs one lookup.
- A style sheet becomes a factory. `const styles = StyleSheet.create`
  turns into `const makeStyles = (colors: Palette) => ({ styles:
  StyleSheet.create })`, and the component calls the hook. A codemod
  does the rewrite for all 43 files, so the pattern is uniform and a
  reviewer can rerun it.
- Lint fails an import of `colors` from `@/theme/tokens`. The module
  constant is gone, so nothing can bake a palette in again.
- The palettes gain one dark entry, `midnight`, ported from
  monkey-budget's `midnight` theme and mapped onto the existing keys.
  No screen branches on light or dark.

We rejected CSS custom properties. They reach the web build, and they
do not reach native views. We rejected reloading on switch for the same
reason as today: a reload loses screen state. We rejected an animated
theme crossfade. It needs a second color value per property, and the
ticket asks for a repaint, not a transition.

## Consequences

A switch re-renders the components that read the context. No component
remounts, so the current screen, its scroll offsets and an open sheet
stay as they are. A sheet that renders through `OverlayHost` also
repaints, because `ThemeProvider` sits above the host.

Every component that colors itself pays one hook call and one cached
sheet per palette it has visited. A palette that is never used creates
no sheet.

Text colors must stay at 4.5 to 1 or better against their ground. The
contrast test lists every text pair for every palette and fails below
4.5. `inkFaint` is the disabled and placeholder step, and WCAG exempts
disabled text, so it is not in the 4.5 set. Hairlines are decoration,
and they are not either. The test names both exclusions.

The light palettes change two accent values. Todoist's red was 4.08 to
1 against white, and clay's terracotta was 4.00 to 1 on its soft fill,
so both failed AA as button and quiet-button text. We darkened each one
step. The test now holds all four palettes to the same rule.
