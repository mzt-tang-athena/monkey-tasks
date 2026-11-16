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
