---
title: Android keyboard proof
created: 2026-11-19
priority: high
assignee: omp
pr:
depends: []
---

## Spec

Two faults came out of the sheet inset lane's screenshots. The task
editor lost its keyboard in three-button navigation, and its text
handle sat away from the cursor.

Both readings came from the proof, not the app. `mInputShown` turns
true when the app asks for the keyboard. The input method's window
draws seconds later on this emulator. The screenshots fell inside that
gap. They show a focused field with no keyboard. They also show a
handle at the place the field held before the sheet lifted.

Make the proof ask the window manager what has drawn.

- A drive step waits for the keyboard to draw and settle.
- A reader finds the insertion handle and the caret in one shot.
- A journey proves both faults on the emulator, in both navigation
  modes.

## Acceptance

- [ ] `android-drive.sh keyboard up` waits for the drawn, settled
      keyboard and fails on a request alone
- [ ] `android-handle.mjs` reads the handle and the caret from a shot
      and calls a handle off the caret's line stranded
- [ ] the reader calls the lane's `f8-editor-gesture-keyboard.png`
      stranded and its `b1-editor-three-keyboard.png` fine
- [ ] the journey reports the keyboard settled and the handle with the
      caret in five tries per navigation mode
- [ ] the skill lists the step, the reader and the journey

## Outcome

Both faults came from the proof. The editor kept its keyboard, and its
text handle followed the lift. The lane's shots fell inside the input
method's slow appearance on this host, where no keyboard had drawn yet.

- `keyboard up|down` waits for the drawn window and a still frame.
- `android-handle.mjs` reads the handle against the caret in one shot.
- The journey holds in 5 of 5 tries per mode, with the handle on the
  caret after the lift.
- The reader calls the lane's stranded frame stranded, and its good
  frame fine.

The app carries no change. No JavaScript path can place the handle.
The current tree puts it on the caret on every frame we caught.
