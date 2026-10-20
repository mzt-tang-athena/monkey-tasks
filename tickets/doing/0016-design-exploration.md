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

- [ ] three variants rendered and screenshotted
- [ ] user picked a direction and gave combination notes
- [ ] the locked theme module lands as the ticket's PR
