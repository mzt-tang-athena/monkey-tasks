---
title: Component gallery and visual baselines
created: 2026-11-12
priority: high
assignee: omp
pr:
depends: []
---

## Spec

The app has 15 primitives in `app/src/components/ui` and no review
surface. State drift shows up on real screens, and ticket 0082 exists
because of it. There is no visual regression check: `toHaveScreenshot`
appears nowhere in the e2e suite.

Add a hidden gallery route, `app/src/app/gallery.tsx`, a thin re-export of
`features/gallery`. Reach it from Settings > Diagnostics, never from the
bottom bar.

Render every primitive in every state, at 360 and 412 wide, in all four
palettes:

- Button: primary, secondary, text, disabled
- Pressable: rest, pressed, focused
- IconButton: rest, active, focused
- SegmentedControl, TabStrip, Pill
- TextField: rest, focused, error
- Menu: open
- Sheet: open
- Banner: each tone
- Toast
- The task row face: rest, done, selected

Label every state in the page so a screenshot reads on its own.

Then a Playwright spec that opens the gallery and asserts:

- every primitive is present and named for assistive tech,
- every target is 44pt or larger,
- axe reports no serious or critical issue in every palette,
- one screenshot per palette at both widths.

Pixel baselines depend on fonts. Try `toHaveScreenshot` and commit the
baselines only if CI produces the same pixels. If fonts differ on the CI
runner, keep the screenshots as artifacts and assert computed geometry and
colour instead. State which path was taken and why in the ticket Outcome.

The gallery is a dev surface. It ships in the bundle but has no
production entry point.

## Acceptance

- [ ] `/gallery` renders every primitive, state and palette at 360 and
      412.
- [ ] It is reachable from Diagnostics only.
- [ ] The spec covers presence, names, 44pt targets and axe in four
      palettes.
- [ ] A visual check exists and is stable in CI, or the reason it cannot
      be is recorded.
- [ ] No production screen changes.
- [ ] `npx tsc --noEmit`, `npx eslint src scripts e2e --max-warnings 0`,
      `npx vitest run` and the e2e pass.
- [ ] No new CI job.

## Outcome

(filled in before moving to done/)
