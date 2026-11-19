# The keyboard proof waits for the drawn keyboard

- **Status:** accepted
- **Date:** 2026-11-19

## Context

A lane proved a sheet above the soft keyboard by polling `mInputShown`
and then taking the shot. That flag turns true when the app asks for
the keyboard. The input method's window appears seconds later on this
emulator. The sheet inset lane shot the editor inside that gap. The
title held focus and no keyboard showed. Read as a bug, that looked
like the keyboard closing by itself.

The same run also photographed the text field's insertion handle while
it moved. It sat at the frame the field held before the sheet lifted.
The journal called that a handle left behind.

Both readings came from one cause. The proof asked the window manager
about intent. The screenshot answered about pixels.

## Decision

`android-drive.sh keyboard up|down [secs]` waits for the keyboard
itself, not for the request. It takes two matching samples of three
facts:

- `mInputShown=true` in `dumpsys input_method`.
- The `InputMethod` window drawn, as `mDrawState=HAS_DRAWN` and
  `isVisible=true` in `dumpsys window windows`.
- The window's `Frames:` line, unchanged between the samples. That
  line moves while the inset animation runs.

Two matching samples keep one slow frame from passing.

`scripts/android-handle.mjs` reads a screenshot and reports the
insertion handle against the caret. Both draw in the accent ink, so
one color pass finds both. A handle counts as stranded when it sits
away from the caret's line.

`journeys/android-editor-keyboard.sh` taps the editor's title and
takes six shots as the sheet lifts. It runs the reader on each shot,
then waits for the settled keyboard.

We rejected longer sleeps. The host's frame rate moves by a factor of
five between passes. No sleep is long enough on a loaded host, and
every sleep burns time on a quiet one.

## Consequences

A keyboard claim now fails when the keyboard has not drawn. It waits
only as long as the host needs. The step costs two `dumpsys` calls per
sample.

The handle check needs the accent ink and the caret in one frame. A
shot where the caret blinks off reads `no caret`, and it counts
neither way.

Android fades the insertion handle on its own. `android.widget.Editor`
holds `DELAY_BEFORE_HANDLE_FADES_OUT = 4000` (line 183 on
`android15-release`). `InsertionPointCursorController.show()` calls
`hideAfterDelay()` (line 6734), and that posts the hide runnable at
line 5818. A shot after those four seconds shows no handle, and that
is correct.

The journey reads the handle inside that window. Its frames run from
one second before the tap to two seconds after. The settled shot that
follows reports what it sees and judges nothing.

Source:
<https://android.googlesource.com/platform/frameworks/base/+/refs/heads/android15-release/core/java/android/widget/Editor.java>

The earlier lane's screenshots keep their value as history. The
conclusions drawn from them do not.
