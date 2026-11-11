# Reach settings from each tab

- **Status:** accepted
- **Date:** 2026-11-11

## Context

Ticket 0083 gave the app a runtime theme provider. No screen shows the
palette picker. The sort order and the task form live in
`app/src/lib/settings.ts`, and each screen owns its own copy. A change
made on a settings screen would not reach a screen that is already
mounted under the tab navigator or the stack.

Ticket 0084 asks for one screen, one tap away from Lists and from
Planner. It owns the palette picker and the two stored settings. Back
must return to the same tab and the same planner mode.

## Decision

Settings is one stack route, `app/src/app/settings.tsx`, which
re-exports `features/settings`. Lists opens it from its overflow menu.
Planner opens it from a 44pt gear beside the mode switch. Every entry
uses `router.push("/settings")`, so the tab screen stays mounted under
the pushed screen and back returns to it.

The theme stays with `ThemeProvider`, because the whole tree reads it
from context. The other two settings go through a small subscription
store, `app/src/lib/settings-store.ts`. A reader seeds itself from
`loadSettings()` and subscribes to the store. A write saves through
`saveSetting` and wakes every reader, which reads the saved value back.

We rejected a focus refresh. It re-reads only when a screen regains
focus, so a screen that stays mounted beside the settings route can show
a stale value. We rejected a second React context. It would wrap the
whole tree for two values that two screens read.

The screen hides the stack header and draws its own 44pt Back button.
The native header's 30pt back link fails the touch target rule and does
not follow the palette.

The build channel reads `__DEV__`. EAS does not put its channel on the
manifest that `expo-constants` exposes, so a preview build reads
`production`.

## Consequences

A settings write repaints the theme in place and updates the mounted
Lists and Planner screens at once. A reader that mounts later reads the
saved value, so a tab that was closed agrees with the tab that was open.

Each reader holds one effect and one subscription. The store keeps no
copy of the values, so it cannot drift from storage. The cost is a
synchronous read of the settings on mount and on each write, which is
one small JSON file or one storage read.

The theme picker is a radio group. The two screen settings reuse the
segmented control, which reports `aria-selected` on a tab list. The
ticket asks for a radio group only for the palette.

Diagnostics shows the dev route today. The crash log from ticket 0081
adds a section beside it, not a dead row now.
