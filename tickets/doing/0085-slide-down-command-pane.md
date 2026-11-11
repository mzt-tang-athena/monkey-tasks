---
id: 0085
title: A command pane that slides down
created: 2026-11-11
priority: normal
assignee: opencode
pr:
depends: [0084]
---

## Spec

A command pane that slides down from the top edge over the current
screen. It is a command palette, not a drawer of settings.

- Opens on a downward pull on the header band, or a two-finger swipe
  down. Only the header band starts the gesture.
- A search field takes focus on open.
- Commands: Add task, Go to Lists, Go to Planner, switch list, sort
  mode, theme, Settings, Diagnostics.
- Recent commands first. At most 12 rows. Each row is 44pt.
- Escape, Android back, a tap outside, or a pull up closes it.
- Focus moves in on open and back to the opener on close. The screen
  behind is inert.
- Reuse the overlay host, the one press component and the focus rules
  from 0063.

Build the pane in two steps. First a prototype with a static command
list that proves the open, the search, the choice, the close and the
focus return. Then wire the real actions and the gesture.

The gesture must not fight the pager swipe, the list scroll or a row
drag. Prove the exclusions with tests. A downward pull that starts on
a list row or a pager body does nothing.

## Acceptance

- [ ] The prototype opens, filters, chooses and closes in the web
      build, and focus returns to the opener.
- [ ] The pane slides with a spring on the phone with no jump at open
      or close.
- [ ] A list swipe, a pager swipe and a row drag never open the pane.
- [ ] Every command does what its label says and closes the pane.
- [ ] Keyboard and TalkBack reach every row. Back closes the pane
      first.
- [ ] e2e covers open, search, choose, escape, back and the three
      gesture exclusions.

## Outcome

The command pane is built and wired. It opens from a downward pull on
the Lists or Planner header band, from a two-finger swipe down, or from
the header's "open commands" button. The search takes focus, the screen
behind is inert, and Escape, Android back, a tap outside, the Close
button or a pull up closes it. Focus returns to the opener.

Commands: Add task (the focused tab's capture sheet), Go to Lists, Go
to Planner, Switch list (one row, moves to the next tab and wraps),
Sort mode, Theme, Settings and Diagnostics. Theme and Sort mode open
the Settings screen instead of repeating its pickers. Recent commands
come first and the pane caps at 12 rows.

The list scroll, the pager swipe and a row drag never open it. Tests
cover all three. The web suite sends two touch points for the
two-finger swipe. The Android emulator and a phone were not run, so
the pull feel, the two-finger gesture and TalkBack are still open for
the operator.
