---
title: Sheets clear the keyboard, not the inset too
created: 2026-11-18
priority: high
assignee: omp
pr:
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

- [ ] Keyboard up: the panel ends 8pt above the keyboard.
- [ ] Keyboard down: the panel ends 8pt above the inset.
- [ ] Three-button and gesture navigation both hold.
- [ ] The editor, pickers, note editors and composers hold.
- [ ] The keyboard's motion stays on the UI thread.
- [ ] A component test fails on main.
- [ ] ADR 20261118-sheets-clear-the-system-navigation gains an
      amendment.

## Outcome

(filled in before moving to done/)
