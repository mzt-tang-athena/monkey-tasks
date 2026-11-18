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

## Amendment, 2026-11-18: the pull spans the page, the bar carries the opener

The operator picked this from a mockup on 2026-11-18. Three parts.

The pull now covers the page body, not only the header band. Each page
scroller offers it on all four tabs. The scroller reads its own offset,
and the pull acts only while that offset sits at the top. A pull that
starts lower down only scrolls. The pull takes a downward travel alone.
Upward travel keeps the scroll. A sideways drag with little downward
travel leaves the pager its swipe. The row drag, the day split and a
sheet never start it. A pull over a row arms the press guard, so the
row does not open too.

A pan around a scroller does not work for this. On Android the scroll
view claims the first vertical drag, even at the top, and cancels the
pan. On the web the browser does the same with its own scroll. So
`MotionScrollView` reads the scroller's own touch events instead. A
drag that starts at the top and travels down holds the page still. On
the web it prevents the `touchmove` default. Upward travel stays with
the scroll. The pane still springs from the top edge on the UI thread.

Alternative: set `touch-action: none` on a page at its top. We rejected
it. It also blocks an upward drag, so a reader could not scroll down
from the top of a page.

Pull-to-refresh leaves Lists, Journal and Inbox Notes. The pull belongs
to the pane on every page. The vault already rereads when the app
returns to the foreground. The pane gains "Reload vault". It
invalidates every vault query, so the shown screen rereads now. Another
tab rereads when it mounts again.

The opener moves into the bottom bar as a split Add pill. The left half
draws the plus. The right half draws Phosphor's Command glyph. Each
half is a 44pt square with its own name. A keyboard and TalkBack reach
"add task" and "open commands" separately. The pill is about 89pt, so
four tabs and the pill still fit a 360pt screen. The Add half keeps the
tab's own action and name.

The Planner header drops its chevron and its gear. The Lists toolbar
drops its chevron too. The bar carries the opener on every tab, so a
second one only shortens the row. Settings stays in the pane and in the
Lists three-dot menu. A header band still pulls open the pane, so the
always-visible chrome keeps a fast path.

Alternatives we rejected:

- Keep the opener out of the bar: thumbs cannot reach it.
- Keep the word "Add": it does not fit beside two 44pt targets.
- Use a magnifying glass: the operator read it as search.
- Keep refresh on Inbox Notes: the top pull opens the pane.
- Pull only the header band: the other tabs have no band.

The scroller owns the offset, so the pane needs no screen to open. A
sheet that draws over a page sits outside the page's provider. Its own
scroller never opens the pane behind it.

Proof: `e2e/specs/commands.spec.ts` pulls at the top of each tab. It
pulls on a scrolled page and reads the scroll and the shut pane. It
drags a row and the split grip, swipes the pager and pulls in a sheet.
The emulator run reads the Lists and Journal pulls. It also reads a row
drag, a page swipe and the bar at 360dp.
