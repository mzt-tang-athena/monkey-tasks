# A command pane that slides down

- **Status:** accepted
- **Date:** 2026-11-11

## Context

The app has quick actions, but no one place to find them. Settings lives
behind the list menu and the planner gear. A list switch needs the Lists
tab. A theme change needs the Settings screen. A phone user with a
keyboard, or a TalkBack user, has no shortcut to any of it.

Ticket 0085 asks for a command palette. It drops from the top edge over
the current screen. A downward pull on the header band opens it. The
pull must not fight the list scroll, the pager swipe or a row drag.

The app already has one overlay host and one focus system from ticket
0063. The pane must use them, not add a second portal or a second way
to move focus.

## Decision

We add one `CommandPane` to `components/ui`, drawn through `OverlayHost`
at the sheet layers. It slides from the top on a spring. It owns the
search, the scrim, the focus into the search, and the focus back to the
opener. Escape, Android back, a press outside and a pull up close it.
`useOpenerFocus` moves the focus for the pane and the existing `Sheet`.

We mount the pane once, in `CommandPaneProvider` above the tab stack.
The provider reads the list names, the selected list, the sort order and
the palette from the shared stores. It builds the rows. The pane needs
no screen to open.

A `PullSurface` in `components/motion` owns the gesture. It wraps only
the header band, so a list row, the pager body and a row drag cannot
start it. The same surface, turned upward, closes the pane from its top
block. A single pan accepts one or two fingers.

We add an "open commands" button to each header band. A pull is not
reachable by a keyboard or TalkBack, so the button is the accessible
opener. The pull stays as the fast path.

The switch-list row moves one tab along and wraps. A row per list did
not fit: the sample vault has nine list notes, and the 12-row cap hid
Settings and Diagnostics. One row always fits, and its hint names the
tab it goes to.

Theme and Sort mode open the Settings screen rather than repeat its
pickers. The pane is an index of actions, not a settings drawer.

The recent list is per session. It is not persisted: the list is small,
and a stale recent row after a restart is worse than a short session
memory.

## Consequences

The pane opens on Lists and Planner. Another screen can have it by
adding its own header band or calling `useCommandPane().show`, because
the provider sits above the whole stack.

A command that opens a sheet runs after the pane closes. The pane still
plays its exit over the new screen for a few frames. The two overlays
share the sheet layer, so the pane leaves above the sheet that enters.

The row cap is 12. With the sample's nine lists, the old per-list design
proved the cap could hide core commands. The single switch row keeps
every command visible and searchable.

The two-finger path uses the same pan as one finger. The web test sends
two touch points and opens the pane. The Android emulator has not run
that gesture, so a phone check is still open.

Alternative: open the pane from a per-screen drawer. We rejected it. It
would duplicate the row list on every screen and put the pane below the
overlay host, outside the one focus system.
