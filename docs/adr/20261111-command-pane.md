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
not fit. The sample vault has nine list notes, and the 12-row cap hid
Settings and Diagnostics. One row always fits, and its hint names the
tab it goes to.

Theme and Sort mode open the Settings screen rather than repeat its
pickers. The pane is an index of actions rather than a settings drawer.

The recent list is per session. The app does not persist it. The list is
small, and a stale recent row after a restart is worse than a short
session memory.

## Consequences

The pane opens on Lists and Planner. Another screen can have it by
adding its own header band or calling `useCommandPane().show`. That works
because the provider sits above the whole stack.

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
would duplicate the row list on every screen. It would also put the pane
below the overlay host, outside the one focus system.

## Amendment, 2026-11-18: the bar's gap opens the pane

The operator picked this from a mockup on 2026-11-18. It replaces the
pull that ticket 0085 put on the header band.

The command pane opens from the bottom bar. A downward swipe on the
empty gap between the last tab and the split Add pill opens it. The
pane still drops from the top edge. The gap holds no control, so the
swipe reads as neither a tab press nor an Add.

We rejected a pull on the page body. A tab body holds rows, checkboxes,
day cells and grips. A pull has to win the gesture from each one. Every
miss costs the user a scroll or a drag. The bar is the one row every
tab shares. Its gap is the one place with no job of its own.

The header band lost its pull too. One gesture in one place is easier
to find than two nearly alike.

Pull-to-refresh comes back on Lists and Journal. The list body now
belongs to the scroll and to the refresh, as it did before. Inbox
Notes keeps its read on mount and on Reload vault.

The pane keeps "Reload vault". It invalidates every vault query, so the
shown screen rereads now. Another tab rereads when it mounts again.

The opener's accessible half stays in the bar. The action is a split
Add pill. The left half draws the plus and runs the tab's own Add. The
right half draws Phosphor's Command glyph and opens the pane. Each half
is a 44pt square with its own name, "add task" and "open commands". The pill is about 89pt, so four tabs and the pill still fit
a 360pt screen. The Add half keeps the tab's own action and name. The
gap between the nav and the pill is the swipe target, about 24pt wide
at the narrowest. The gap sits at the screen's edge, so its swipe
commits at 18pt: a longer pull runs out of screen. A phone has more
room, but the same threshold works on both.

The Planner header drops its chevron and its gear, and the Lists
toolbar drops its chevron. The bar carries the opener on every tab.
Settings stays in the pane and in the Lists three-dot menu.

Alternatives we rejected:

- Keep the opener out of the bar: thumbs cannot reach it.
- Keep the word "Add": it does not fit beside two 44pt targets.
- Use a magnifying glass: the operator read it as search.
- Pull the page body: the body's controls need the gesture.
- Keep the header-band pulls: two openers for one action.

The bar gap's swipe starts only in the gap. A swipe on a tab keeps its
tab, and a swipe on either Add half runs no Add. A swipe on a list body
scrolls or refreshes and opens no pane.

Proof: `e2e/specs/commands.spec.ts` swipes the gap and reads the pane.
It swipes a tab, both pill halves and a list body, and reads no pane.
The emulator run repeats the gap swipe and checks the tab and pill
swipes. It pulls a list body to refresh a note written from outside.
It also reads the bar at 360dp.
