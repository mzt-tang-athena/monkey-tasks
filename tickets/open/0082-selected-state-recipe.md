---
id: 0082
title: One recipe for selected and active states
created: 2026-11-11
priority: high
assignee:
pr:
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

- [ ] Three mockups, one rule each, on the three real screens.
- [ ] The operator picks one. Record the pick and its rule.
- [ ] The winner ships in `IconButton`, tabs, segmented control, pill,
      month and week cells, list rows and drag targets.
- [ ] The sort icon's mark clears the header edge by at least 4pt.
- [ ] A week drop target paints inside its column and leaves the gap
      untouched, motion on and reduced motion.
- [ ] Contrast test and axe clean. Screenshots before and after for
      each state.

## Outcome

(filled in before moving to done/)
