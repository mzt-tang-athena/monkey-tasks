# 0008. Variant F quiet custom accent

- **Status:** proposed
- **Date:** 2026-10-20

## Context

Round 2 of the design exploration needs a custom accent. The user
rejected Variant B's sage as budget green, Variant A's blue as "too
googly", and pointed at Todoist's red-orange only as a direction. The
accent must read clearly on cream paper and stay calm. Variant F is
the most generous-spacing variant, so the accent must survive large
empty areas without shouting.

## Decision

Variant F uses one muted warm clay accent, `#A65B3B`
(about OKLCH 0.60 0.08 50), on cream paper `#F7F4E4`. We picked clay
over olive because clay keeps its warmth against the yellow paper,
while olive drifts towards the sage the user already rejected. We
rejected the Todoist red-orange itself because its saturation fights
the paper. Danger stays a deeper oxblood, `#8F3B2C`, so overdue still
reads as a warning next to the clay.

Spacing stretches B's 8pt scale with a 40pt group step, and rows grow
to 64pt. The capture affordance is a persistent inline composer above
the bottom bar; there is no round add button anywhere.

## Consequences

The palette is one accent plus neutrals, so new screens have no
color decisions to make. If the user merges a different variant, only
`tokens.ts` carries the palette, so a merge is cheap. The clay is
untested against real vault content with long names and many overdue
rows; the round-2 review should check that.
