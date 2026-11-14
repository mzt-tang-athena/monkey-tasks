# 0014. Keyboard height from the keyboard controller library

- **Status:** accepted
- **Date:** 2026-10-22

## Context

Android 15 and later draw every app edge to edge. The system no longer
resizes the window when the keyboard opens. This left the capture sheet
behind the keyboard on the device.

React Native reports the keyboard height through its Keyboard module. That
module reads the window insets during a layout pass. Under edge to edge no
layout pass happens when the keyboard opens. The event never arrives, and
the app cannot learn the height. We measured this on an Android 16 emulator
that reproduces the phone.

We tried two other ways first. The window pan mode moves the window for the
keyboard. But the system computes the pan from the visible display frame.
That frame does not change under edge to edge. The pan was near zero, and
the sheet stayed behind the keyboard. A lift computed from the React Native
keyboard event could never run, because the event never arrives.

## Decision

We add react-native-keyboard-controller. It reads the keyboard insets in the
native view instead of a layout pass. That lets it work under edge to edge.
The capture sheet uses its keyboard-avoiding view.

We keep the keyboard height in one place: the view that owns the sheet.

## Consequences

The app gains one native dependency. The build compiles one more Android
module, and the first build after this takes longer.

The capture sheet floats above the keyboard on every Android version. The
code no longer guesses how far to lift the sheet.

The React Native Keyboard module stays out of the layout code. The
diagnostics screen still reads it, so the difference between the two
sources stays visible.
