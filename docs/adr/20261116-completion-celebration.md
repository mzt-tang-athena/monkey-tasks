# A tick draws a short burst

- **Status:** accepted
- **Date:** 2026-11-16

## Context

Ticking a task already gives a small sign. The circle pops, a wash
crosses the row, and the row moves to Completed (ADR 0034). The
operator wants a celebration on top of that, like the light burst in
Todoist and Google Tasks. Version 1.0 ships this week, and the
operator uses the app daily. The effect must feel good, cost little,
and never get in the way.

Three facts limit the shape:

- The row cannot hold the burst. A ticked row stays in place for the
  tick's 320 ms. After that it becomes a new element in Completed (ADR
  0034). An effect drawn inside the row stops there.
- Reduced motion gets no particles. ADR 0036 makes every animation
  pass `ReduceMotion.System`.
- Reanimated, Worklets and the overlay host are already in the tree.
  The tree needs no new dependency.

## Decision

A press on an open circle sends the circle's place on screen to a
`CelebrationProvider` in the root layout. The provider draws one burst
there, above the list, for 520 ms. Then it removes the burst.

The look is a ring plus eight dots. The ring opens from the tick's
24 pt circle and fades as it grows. The dots fly out, fall a little,
and fade. The colors are the active palette's `accent` and
`accentDeep`, so every theme repaints the burst in place. A fixed table
holds each dot's angle, distance and size, so a burst is the same every
time.

The burst draws at `layers.celebrate`, between the content and the
bottom bar. It never covers a bar or a menu, and it takes no press.

The press triggers the burst. The data alone never does. A press on a
row that is not done celebrates. An undo presses a done row, so it
plays nothing. A sync, a reload or another app writing the note never
presses, so it plays nothing too.

With reduced motion the provider mounts nothing. The still tick that
exists today is the whole confirmation.

## Consequences

The cost is small. Every part has a bound:

- One `measureInWindow` call per tick.
- Two provider renders per burst, one at mount and one at removal.
- Nine animated views and nine worklets while a burst shows. The
  worklets run on the UI thread and read one shared value.
- No timer, no JS work per frame, and no new dependency. A row the
  user did not tick does not render.

The row's tick and its leave keep their timing. The burst draws outside
the row, so the regroup at 320 ms does not cut it.

A burst can paint over the header band when a row near the top ticks.
We accept that. Confetti over chrome is normal, and clipping the burst
to the list would need a measured list box.

The web preview proves the look, the trigger and the color. It cannot
prove the UI thread. A device pass still needs a release APK with this
change.

## Alternatives

**A ring alone.** We built it first and captured it. It read as part of
the tick, not as a celebration. Its visible life was under 400 ms.
Rejected.

**The burst inside the row.** It stops when the row moves to
Completed, so at 320 ms. Rejected.

**Hold the row until the burst ends.** It delays the leave, which the
operator ruled out, and it weakens ADR 0034's rule.

**A confetti library.** It adds a dependency and often runs on the JS
thread. Reanimated and the overlay host already do the work.

**A haptic.** The tree has no haptics module. Adding one needs a native
rebuild, and the operator asked for no new dependency.

## Verification

The evidence is in
`app/build/verify/evidence/completion-celebration/`. It holds a frame
series from the web preview and the before and after shots. A reduced
motion run draws no burst.

The component tests cover the trigger. A user tick plays. An undo, a
data change with no press, and reduced motion play nothing.

The e2e spec watches the document for the burst. It proves one mount
on a tick and no standing burst once the run ends. The reduced motion
project proves no mount.

## Amendment, 2026-11-17: every tick plays, from the surface it ticked

The editor became a sheet (ADR 20261116-task-editor-sheet) while this
decision was in review. Two things changed.

**The provider sits above the editor.** In the root layout the
celebration wraps the command pane and the editor provider, all inside
`OverlayHost`. It has to sit inside the host, because the burst is an
overlay and takes the host's one z order. It has to sit above the
editor, because the sheet's tick asks the same provider for a burst.

**The sheet's tick plays too.** A mark done in the sheet was silent, so
a tick felt different there. Every tick control now plays the burst
from its own circle. The rule is one hook, `useTickBurst(done)`. A
press plays when it marks the task done. A press that reopens a done
task plays nothing. The sheet also shows the done state, so its control
says what it does. It reads `mark done`, or `mark not done` on a done
task.

The surfaces with a tick press, and whether each plays:

| Surface | Plays |
| --- | --- |
| A Lists row | yes |
| A Planner day row and its overdue group | yes |
| A Planner week and month list row | yes |
| A Planner timeline task chip | yes |
| The editor sheet's tick | yes, when it marks done |

**The layer follows the surface.** A burst from the page draws at
`layers.celebrate`, between the content and the bottom bar, as above. A
burst from inside the sheet draws at `layers.celebrateSheet`, over the
sheet and under the toast. At the page layer the opaque panel would
hide it. The sheet also leaves in 220 ms, so the user would see the
burst appear late and half faded. Only a press inside the sheet can ask
for that layer. The sheet's scrim takes every other press while it
shows.

The Android pass now backs the look on the UI thread. The frames are in
`app/build/verify/evidence/completion-celebration/android/`.

## Amendment, 2026-11-18: a page burst stops at the bottom bar

The original decision put the page burst at `layers.celebrate`, between
the content and the bottom bar. That order works only when both sit in
one stacking context. They do not. The burst is an overlay in the root
host, above every screen. The bar is inside a screen. The layer number
never ordered the two. At 412 wide, a row ticked just above the bar
painted dots over the bar's top edge.

The page layer now ends at the bar's top edge. The bar reports its
measured height, with the safe-area band included. A small provider
hands that number to the root. The page burst layer clips at that
height. The bar itself does not move.

The sheet layer is not clipped. A burst from the editor sheet still
draws over that sheet and under the toast. Menus, sheets and toasts sit
at higher layers, so they still draw over a page burst. Reduced motion
still mounts nothing.

The change has three costs:

- The clip cuts a burst on a low row short of its full reach. We
  accept that. The bar is opaque chrome, and the burst belongs on the
  page.
- The clip uses the bar's layout height. The bar slides away while the
  capture sheet shows. A page burst cannot start then, because the
  sheet takes every press. A burst already in flight may show in the
  strip the bar just left, and the scrim covers it.
- A screen with no bar keeps the last height. No barless screen has a
  tick row.

Alternative: draw the page burst inside each screen, under its bar.
Rejected. The burst is one root provider that serves every screen and
the sheet. A per-screen copy would add an overlay and a coordinate
shift for the same pixels.

