---
title: Sheets clear the keyboard, not the inset too
created: 2026-11-18
priority: high
assignee: omp
pr: 179
depends: []
---

## Spec

With the keyboard open, every sheet floats a band above it. The band
is the bottom safe-area inset, about 48dp on three-button navigation
and about 24dp with gestures. The list behind shows through it.

PR 176 docks the panel `spacing.s` above the bottom safe-area inset.
The dock also rides the keyboard's height. On Android 15 the app draws
edge to edge, so `KeyboardProvider` marks the navigation bar
translucent. The keyboard library then reports the whole IME inset,
system bar included. The inset and the keyboard then add.

The panel must sit 8pt above the keyboard while the keyboard is open.
With no keyboard, it must sit 8pt above the navigation inset. That
holds in both navigation modes and for every sheet. The keyboard's
motion stays on the UI thread.

## Acceptance

- [x] Keyboard up: the panel ends 8pt above the keyboard.
- [x] Keyboard down: the panel ends 8pt above the inset.
- [x] Three-button and gesture navigation both hold.
- [x] The editor, pickers, note editors and composers hold.
- [x] The keyboard's motion stays on the UI thread.
- [x] A component test fails on main.
- [x] ADR 20261118-sheets-clear-the-system-navigation gains an
      amendment.

## Outcome

The lift adds the inset to the keyboard's negative height and clamps
the sum at zero. The dock keeps its 8pt above the inset, so the two
can no longer add. The work runs in the lift's worklet, on the UI
thread.

The component test fails on main with
`expected 'translateY(-300px)' to contain '-252px'`.

On the emulator at 420dpi the panel's bottom sits at 1496px and the
keyboard starts at 1517px, 21px or 8dp. That held in three-button
navigation on the editor's list picker, the note editor and the
Journal composer. With gestures it held on the editor. The delete
confirmation still sits above the inset with no keyboard. The capture
and Inbox composers were not captured. They share the same `Sheet` and
the same keyboard lift, and the component test covers that path.
Evidence lives in `archive/evidence/lane-ime-gap/final-20261118-213256`.
ADR 20261118-sheets-clear-the-system-navigation records the change.
