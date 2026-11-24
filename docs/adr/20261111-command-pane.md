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

## Amendment, 2026-11-19: the pane reaches every tab

The pane carried a Go to Lists row and a Go to Planner row.
The app has four tabs: Lists, Planner, Journal and Inbox Notes.
Journal and Inbox Notes had no row, so the pane could not reach them.

The pane now carries a Go to Journal row and a Go to Inbox Notes row.
They sit after Go to Planner, in tab order.
Each one navigates to its tab.

The rows carry the words their screen uses.
Journal matches "daily", "diary" and "food".
Inbox Notes matches "notes" and "scratch".

The resting pane now draws 11 rows of its 12-row cap.
One more command would push Diagnostics off the pane.

Proof: `commands.spec.ts` opens the pane from Lists and presses each of
the four rows in turn.
Each lands its screen, and the pane shuts.

## Amendment, 2026-11-20: the pane rises from the bottom edge

The operator used 1.2.0 on the phone.
Obsidian's command pane rises from below.
This app's opener sits in the bottom bar.
A pane that drops from the top edge starts far from the finger.
The operator asked for the rise on 2026-11-20.

The pane now sits at the bottom edge.
It rises to meet the finger.

- The search is the panel's lowest block, above the keyboard.
- The rows read up from the search, so the first row is nearest it.
- The list rests at its end, so a filter shows the first match.
- A drag down on the title row follows the finger and closes.
- The bar's gap takes an upward swipe, and the pane rises with it.

The search is the thumb's target, so the rows sit above it.
The first command lands where the hand already is.
The list opens scrolled to its end.
The scrim, the focus and the two closes stay as they were.
The press outside, the Close button and every row's words stay too.

The panel rides the keyboard on the lift from
`20261118-sheet-clears-the-keyboard`.
Its cap holds to the room between the keyboard's top and the status bar.
The search then sits above the keys.
The first rows stay reachable while it shows.
The web moves no keyboard, so its cap stays the 72% share.

The search takes focus on open, as the app's sheets do with
`autoFocus`.
A focus from an effect left the phone's keyboard down, so the pane did
not lift on the gap's swipe.
`autoFocus` asks while the field mounts, and the keyboard arrives with
the pane.
A rising field sits under the window's edge.
Its focus must not scroll the page.
The pane clips at that edge, and the web asks the field for no scroll.

A drag that lets go short of the sheet's swipe commit returns.
The pane's spring carries it back.
A release past it, or a downward flick, closes the pane.
The clock carries the exit from wherever the finger let go.
The drag and the clock share one transform.
The further of the two travels, so a dismissed pane slides out once.
Two translates would have moved it twice.

The opener changed direction with it.
A downward swipe calls up a pane from below, against the motion.
The bar's gap now takes an upward swipe.
The pane rises as the finger does, so it meets the finger's direction.
It does not track the finger.
A pane that tracks it must stay mounted while shut.
This one leaves the tree when it closes.
The spring reads the same and starts inside a frame.

The bar's gap takes the app's pull commit, 56pt.
The finger now travels into the screen, not into the 24pt below the bar.
The old `bar` and `close` pull tokens left with it.
The pane's own drag takes the sheet's swipe commit and flick.
That is one pull rule and one drag rule for the whole app.

Alternatives we rejected:

- Keep the downward open swipe: it pulls against the rise.
- Follow the opening finger: it needs a pane mounted while shut.
- Travel the clock and the drag as two translates: the exit doubles.

A reduced-motion window shows the pane at rest with no rise.
The clock lands at once.

Proof: `commands.spec.ts` catches the pane mid-rise.
The search sits under the window's edge, and then it reads at rest.
It sends the gap's upward swipe with a touch and with the mouse.
It drags the title row down, and reads a short drag spring back.
It reads the first row nearest the search in both motion projects.
The reduced project reads no slide.

Android proof, this branch's release APK on the Pixel 7 emulator:

- The gap's upward swipe opens the pane with the keyboard up.
- The search ends at 1474px and the keyboard starts at 1517px.
  That is 16dp of air, the sheet's 8pt gap plus the panel's padding.
- The tree reads Diagnostics at the top, Add task at the bottom.
  Add task ends at 1328, above the search.
- A drag down on the title row walks the panel off the bottom edge.
- Back goes to the keyboard first, as the platform gives it, then the
  second Back closes the pane.
- With the animation scales off the pane stands at rest in one frame.
- Frames and shots:
  `app/build/verify/evidence/android-20261120-095625/`.

## Amendment, 2026-11-24: the Add button opens the pane

The operator used 1.2 on the phone. They asked for one wide Add button
in place of the split pill on 2026-11-24. This replaces the gap swipe of
the 2026-11-18 amendment, and the Command half of the same design. The
bar's empty middle loses its swipe, so every tab has one opener.

- A tap on the button runs the tab's own Add.
- A swipe down opens the pane.
- A swipe left or right moves one tab.
- The bar's empty middle carries nothing.

The pane opens on release. It rises on its own spring while the finger
travels down. A live rise would move the panel against the finger. The
2026-11-20 amendment turned down a finger-tracked pane. It needs a pane
mounted while shut. The button carries the gesture instead. It moves up to 12pt with the finger, so a swipe reads
as a swipe.

The pane still rises from the bottom edge. A downward swipe on a pane
that rises upward is the direction the 2026-11-20 amendment rejected.
The operator chose it on 2026-11-24. The button's own travel answers it.

The button is one target about 95pt wide and 48pt tall. It draws the
plus and the word "Add". The Add action looked like that before ADR
`20261117-icon-only-bottom-bar` split it. It carries the tab action's
name: "add task", "add note" or "add entry".

A swipe left goes to the tab on the right, as a pager does. The ends
hold. A swipe past the last tab does nothing, and the button barely
moves. A pager stops at its ends. The bar's glyphs also read left to
right, so a wrap would move the selection against the finger.

The commit is the button's own 24pt. The pager's 80 is too far for a
44pt target at the window's edge. A finger there has about 30pt of room
below it. A travel under the commit runs the tap, so a hand that moved
still adds. The flick is the pager's 500px/s, so a quick throw commits
under the distance.

The gesture measures the finger from where it touched down. A pan's own
translation starts again at its activation point on the web. That would
read a shorter swipe than the phone does for the same hand.

The three jobs sit on the button for a screen reader and a keyboard.
The custom actions are "Open commands", "Next tab" and "Previous tab".
The arrow keys work while the button holds focus. The split pill's
Command half was a keyboard user's only way in, and a swipe reaches
neither.

Alternatives we rejected:

- Keep the header and toolbar openers: two openers for one action.
- Keep the Command half: the operator asked for one button.
- Wrap at the ends: it moves the selection against the finger.
- Drive the rise with the finger: the panel would rise against it.

Proof, both motion projects in the web suite:

- `add-button.spec.ts` taps the button and swipes down, left and right.
  It reads the tab each swipe lands on.
- It moves a tap 12px, and the sheet still opens.
- It reads the button's mid-swipe travel, and reduce's still button.
- `swipe-press.test.tsx` reads the three custom actions and the keys.

Android, this branch's release APK on the Pixel 7 emulator. The frames
are 270 by 600, a quarter of the screen:

- A tap opens the sheet, and the button moves no pixel.
- A swipe down moves the button 8px down, and the pane rises.
- A swipe left moves it 8px left and lands Planner.
- A swipe right moves it 8px right and lands Lists.
- A swipe on the bar's empty middle opens nothing.
- The release smoke passes, the new step included.
- Frames:
  `~/code/monkey-tasks/worktrees/evidence-add-button-swipes/runs/`.
