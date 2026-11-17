---
id: 0082
title: One recipe for selected and active states
created: 2026-11-11
priority: high
assignee: opencode
pr: 148, 151
depends: []
---

## Spec

The app draws selected and active states ad hoc. Two are visibly wrong.

1. The Lists sort icon's active state is a 44pt rounded square from
   `app/src/components/ui/icon-button.tsx`. Its bottom edge touches the
   header's bottom edge.
2. In the week planner, dragging a task over a day paints a full
   `accentSoft` fill from the `Grid` hover box in
   `app/src/components/motion/drag-surface.tsx`. The box spans the
   column pitch. It covers the gap to the right of the column and
   reads as a slab behind the content.

Draw one recipe for selected, active, hover and drop-target states. It
applies across icon buttons, tabs, segmented controls, pills, month and
week selection, list rows and drag targets. The 44pt target stays. The
visible mark does not have to be 44pt.

Rules the recipe must meet:

- No mark clips against a parent edge or bleeds into a gap.
- A drop target reads as an outline or an inset tint inside its cell.
  It never reads as a fill that covers a neighbour's space.
- The same meaning uses the same mark on every screen.
- Contrast is 4.5 to 1 or better.
- No state changes layout.

Use the Hallmark skill. Produce three directions as mockups on the real
screens. Use the Lists header with the sort active and the Planner week
with a day hovered during a drag. Also use the month grid with a day
selected. Each
direction states its rule in one line. The operator picks one on an
html page. Then build the winner as shared tokens and one shared
component, and replace the ad hoc states.

## Acceptance

- [x] Three mockups, one rule each, on the three real screens.
- [x] The operator picks one. Record the pick and its rule.
- [ ] The winner ships in `IconButton`, tabs, segmented control, pill,
      month and week cells, list rows and drag targets.
- [x] The sort icon's mark clears the header edge by at least 4pt.
- [x] A week drop target paints inside its column and leaves the gap
      untouched, motion on and reduced motion.
- [x] Contrast test and axe clean. Screenshots before and after for
      each state.

## Outcome

Direction C (Ink) shipped in both places the operator picked it for.

**The icon half, in #148.** An icon button carries its state in the
glyph. It draws outline at rest and filled when selected, with no box
behind it. The sort icon's mark then clears the header edge, because
the button draws no box.

**The week drop target, in this PR.** `PlanDrag.Grid` takes a
`mark="ring"` option. The grid then draws no box of its own. Each day
box renders a `Ring` inside itself, a 2pt ink border with the box's
own corner. A hover fades it over `motion.ms.tap` and reduced motion
holds it still. Saturday's two Spread cells share one target object, so
either cell rings the one box. The gap between boxes stays paper, and
nothing moves between rest and hover.

**Left open on purpose.** The operator narrowed the pick to the week
drop target. Tabs, segmented controls, pills, month cells and list rows
keep their current state mark, so the third box stays open. A later
ticket can carry the recipe to them.

**Proof.** `ink` on `surface`, `pressed` and `accentSoft` is in the
palette contrast test, in all four palettes. The axe scan passes on the
week screen in every palette. Screenshots at rest and mid-hover, at 360
and 412 wide, are in the PR for the week body. The month grid still
draws the fill box, as the default. That is the before shape.

## Note, 2026-11-16

The operator picked direction C (Ink) for the week drop target only.
Icon buttons carry their state in the glyph. They draw outline at rest
and filled when selected, with no box behind the button. Every other
surface keeps its current state mark.
