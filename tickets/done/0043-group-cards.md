---
id: 0043
title: Group the task list into cards
created: 2026-10-25
priority: normal
assignee: omp
pr: 61
depends: [0042]
---

## Spec

Reported on the phone. The Lists screen reads as one long table: the
group label and a hairline between rows are the only separation, and
the hairlines run the full page width.

Google Tasks and TickTick put each group in a rounded card. Todoist
keeps flat rows but insets its dividers to the text. We take the card:
surface fill, hairline border, the shared radius, the label above, and
dividers inset to the text. No shadow; shadows stay for floating
surfaces (ADR 0022's split, the sheet and the toast).

The row keeps its own padding, so the card adds a border and a radius
and moves no text. A group with one item is a complete card.

## Acceptance

- [ ] Each date group is one card with the label above it.
- [ ] A divider inside a card starts at the text, not the card edge.
- [ ] The completed group is a card at the dimmed opacity.
- [ ] A one-item group is a full card with both radii.
- [ ] No shadow. Colors, radius and spacing come from tokens.
- [ ] The card looks right at 320 and 390 wide.

## Outcome

Each group is one card: surface fill, hairline border, shared radius,
label above, dividers inset to the text. A one-item group is a full
card. The completed group keeps its dimmed opacity.

The card is built from the section's rows: the sides on every row, the
top and its radii on the first, the bottom on the last. The section
list keeps its virtualization and its sticky header, and the row keeps
its own padding, so no text moved.

A second pass on the phone: the rows felt tight. The row's vertical
padding went to 12, its horizontal padding to 16, the circle to 24, the
divider inset to 52, and the gap between groups to 24.

ADR 0030 records the choice against Todoist's flat rows. Verified in
the web preview at 390 by 800 and 320 by 640, including a wrapped row,
a one-item group and the completed group.
