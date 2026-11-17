---
title: Component gallery and visual baselines
created: 2026-11-12
priority: high
assignee: omp
pr: 134
depends: []
---

## Spec

The app has 15 primitives in `app/src/components/ui` and no review
surface. State drift shows up on real screens, and ticket 0082 exists
because of it. No visual regression check exists, because
`toHaveScreenshot` appears nowhere in the e2e suite.

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
colour instead. Note which path the work took, and why, in the ticket Outcome.

The gallery is a dev surface. It ships in the bundle but has no
production entry point.

## Acceptance

- [x] `/gallery` renders every primitive, state and palette at 360 and
      412.
- [x] The gallery is reachable from Diagnostics only.
- [x] The spec covers presence, names, 44pt targets and axe in four
      palettes.
- [x] A visual check exists and is stable in CI, or the ticket records
      why it cannot be.
- [x] No production screen changes.
- [x] `npx tsc --noEmit`, `npx eslint src scripts e2e --max-warnings 0`,
      `npx vitest run` and the e2e pass.
- [x] No new CI job.

## Outcome

`/gallery` draws 17 sections and 35 states from
`features/gallery/model.ts`. The screen maps every state id to a node, so
a state without a node fails `tsc`. The spec walks the same list. The
route opens from one button on the diagnostics screen, which Settings >
Diagnostics opens. Nothing else links to it, and the spec asserts a
`/` page holds no gallery link.

The spec checks all four palettes at 360 and 412 wide:

- every state's cell and its label,
- every control's accessible name,
- every target at 44pt or more,
- axe at serious or critical impact, with two named cells exempt from
  contrast: disabled text and the faint done mark,
- the palette's ground, fills and ink, the page width, every cell inside
  the page, and the section order,
- the menu, sheet, command pane and toast one at a time: names, targets
  and axe.

Visual check: the fallback path. The pixel baselines failed on CI in the
first run. The 360 budget shot differed in 112 pixels. The difference
sat in two 11 by 10 boxes, at x 58, y 3694 and x 58, y 3998. Each box
holds the check glyph of a done row. The runner draws that glyph two pixels from this
machine's. Every other pixel matched. The spec keeps no baselines. It
still takes 8 shots. It keeps them in
`app/build/verify/evidence/component-gallery/` (gitignored) and attaches
them to the report. CI is green on the head that carries this path.

The only production screen change is the "Open gallery" button on the
diagnostics screen. The work restyles no primitive, adds no dependency,
and adds no CI job.

Gates: `npx tsc --noEmit` clean. `npx eslint src scripts e2e
--max-warnings 0` clean. `npx vitest run` 95 files and 833 tests.
`E2E_PORT=8607 npm run e2e` 456 passed and 26 skipped. CI: code, docs and
e2e-web all pass.

The gallery found one defect and leaves it to its own ticket. A visible
hint on a menu item breaks WCAG 2.5.3, because `Menu` names the item by
its label alone. The gallery's menu carries no hint. Ticket
`20261112-menu-hint-name` owns the fix.

It found a second gap in the primitives it reviews. `Pressable`,
`IconButton` and `Button` paint no focus style on web, so two focused
cells look like rest. Their label reads "focused, no ring", and ticket
`20261112-control-focus-ring` owns the missing mark.

The independent verifier also found the 44pt scan skipped `textbox` and
`searchbox`, so an input could shrink and pass. Both roles are in the
scan now.

PR: #134.
