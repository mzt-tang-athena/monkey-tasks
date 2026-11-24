# The planner's picked day lives beside the route

- **Status:** accepted
- **Date:** 2026-11-24

## Context

The planner's mode and day live in the URL.
A link opens the planner on any period.
The screen reads the route back in `use-planner-route.ts`.

The bottom bar and the command pane open the tab at `/planner`.
That write drops `?day=`, so a return read the day as today.
A user who planned a day, checked a list, and came back lost it.
The tab stays mounted. Only the route lost the day.

The period strip's window follows the shown day (ADR 0046).
It holds its cells while the day sits inside today's own window.
It slides once the day walks past either end.
Any fix keeps the day as the one date the strip reads.

## Decision

The day the planner last named lives in a module store, in
`features/planner/lib/picked-day.ts`.
A route that names no day opens on that day.
A route that names one wins for that render, and the planner keeps
it for the next one.

The mode stays in the URL alone.
Its reset is the same size, but no report covers it.
The picked day is what a user loses.

## Consequences

Every way into the tab keeps the day: the bar, the command pane, and a
route with no param.
A link still opens on the day it names.

The store is memory, so a reload starts at today.
Nothing reaches disk or the settings, because the ticket asks for the
app's run only.

A run with no pick still moves on at midnight.
The planner keeps no day until a route names one.
A pick of today holds that date past midnight, as any other pick does.

The address bar no longer carries every day on screen.
A copy of it after a bare return names no day.
The tab dropped that param before this change too.

Alternative: put `?day=` on the bar's and the pane's navigate.
Both sit in shared chrome, and the bar stays feature-agnostic (ADR
`20261117-icon-only-bottom-bar`).
The planner's day would have to reach the bar.
Both call sites would need the change, and a bare route would still
drop the day.
