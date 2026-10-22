---
id: 0016
title: Design exploration: three visual variants
created: 2026-10-20
priority: high
assignee: opencode
pr:
depends: [0009]
---

## Spec

Three agents build three visual interpretations of the Lists and
Planner screens in parallel worktrees, against one shared brief
(utilitarian tone, Todoist-style breathing room, mock data, web
preview for screenshots). The user reviews side by side, picks and
combines; the winning direction becomes the locked theme module and
the visual baseline for tickets 0010 to 0013.

Constraints all variants share:

- Screen structure follows the locked architecture: Lists tab with
  list tabs + capture sheet; Planner tab with month/week/day.
- Mock data only in the design branches; no SAF calls on web.
- Theme lives in one tokens module: colors, fonts, spacing, named.
- All interactive components ship their states (default, pressed,
  disabled, loading, error, success); no invented copy or metrics.

## Acceptance

- [x] three variants rendered and screenshotted
- [x] user picked a direction and gave combination notes
- [x] the locked theme module lands as the ticket's PR

## Outcome

Six variants were built (A to F), not three, plus a round of
combinations. The user picked the quiet custom direction; it was
iterated through 38 rounds on `design-final` and consolidated onto
`main` on 2026-10-22. The locked theme is `app/src/theme/tokens.ts`
(colors, fonts, spacing, radii, measures), and the screens consume it.

The design branches stay as history: `design-a-todoist`,
`design-b-notebook`, `design-c-darkstudio`, `design-d-budgetgreen`,
`design-e-todoistwarm`, `design-f-quietcustom`. Screenshots moved out
of the repo on 2026-10-22 (`.openchamber/` is ignored).
