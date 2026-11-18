---
title: Sheets sit above the system navigation
created: 2026-11-18
priority: high
assignee: omp
pr: 176
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

- [ ] The editor panel ends 8pt above the bottom inset.
- [ ] Every other sheet ends above it too.
- [ ] A drag down still closes a sheet.
- [ ] A component test fails on main.
- [ ] The editor is whole in three-button navigation.
- [ ] The keyboard open keeps it whole.
- [ ] Gesture navigation keeps it whole.

## Outcome

The shared sheet dock reads the bottom safe-area inset. The panel sits
8pt above it, and the scrim still covers the whole window.
The component test fails on main with "expected 8 to be 56".
On the emulator every sheet clears the system buttons. That covers the
editor, its pickers, both note editors, the delete confirmation, the
capture sheet and both composers. The same holds on gesture navigation,
with the keyboard open or closed. A drag down still closes the editor.
Evidence lives under app/build/verify/evidence.
ADR 20261118-sheets-clear-the-system-navigation records the decision.
