---
title: Sheets sit above the system navigation
created: 2026-11-18
priority: high
assignee: omp
pr:
depends: []
---

## Spec

On a phone with three-button navigation, every sheet runs under the
system back, home and recents buttons. The operator saw the task
editor's last row, Repeat, Reminder and Note, cut in half behind them.

The shared sheet docks its panel at `bottom: spacing.s` and never reads
the bottom safe-area inset. Gesture navigation has a thin inset, so the
fault went unseen on the emulator. Three-button navigation uses about
48dp.

Every sheet must keep its whole panel above the system navigation.
That must hold in both navigation modes, with the keyboard open or
closed. The panel keeps its 8pt gap above the inset. Drag to close
stays.

Check every sheet. That covers the task editor, its pickers, the note
editor, the delete confirmation, and the three composers.

## Acceptance

- [ ] The task editor panel ends above the bottom inset, by 8pt.
- [ ] The pickers, note editor, delete confirmation and composers do the same.
- [ ] A drag down still closes a sheet.
- [ ] A component test gives the safe area a bottom inset and fails on main.
- [ ] An APK shows the editor whole under three-button navigation. Check it with the keyboard open and closed.
- [ ] The same APK shows it whole under gesture navigation.

## Outcome

(filled in before moving to done/)
