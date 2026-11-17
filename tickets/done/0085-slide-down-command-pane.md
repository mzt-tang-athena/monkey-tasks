---
id: 0085
title: A command pane that slides down
created: 2026-11-11
priority: normal
assignee: opencode
pr: 124
depends: [0084]
---

## Spec

A command pane that slides down from the top edge over the current
screen. It serves as a command palette rather than a drawer of
settings.

- Opens on a downward pull on the header band, or a two-finger swipe
  down. Only the header band starts the gesture.
- A search field takes focus on open.
- Commands: Add task, Go to Lists, Go to Planner, switch list, sort
  mode, theme, Settings and Diagnostics.
- Recent commands first. At most 12 rows. Each row is 44pt.
- Escape, Android back, a tap outside, or a pull up closes it.
- Focus moves in on open and back to the opener on close. The screen
  behind is inert.
- Reuse the overlay host, the one press component and the focus rules
  from 0063.

Build the pane in two steps. First, a prototype with a static command
list that proves the open, the search, the choice and the close. It
also proves the focus return. Then wire the real actions and the gesture.

The gesture must not fight the pager swipe, the list scroll or a row
drag. Prove the exclusions with tests. A downward pull that starts on
a list row or a pager body does nothing.

## Acceptance

- [x] The prototype opens, filters, chooses and closes in the web
      build, and focus returns to the opener.
- [ ] The pane slides with a spring on the phone with no jump at open
      or close. Not run on a device.
- [x] A list swipe, a pager swipe and a row drag never open the pane.
- [x] Every command does what its label says and closes the pane.
- [ ] Keyboard and TalkBack reach every row. Back closes the pane
      first. The keyboard pass is on the web. TalkBack and the phone's
      back gesture are not run.
- [x] e2e covers open, search, choose, escape, back and the three
      gesture exclusions.

## Outcome

The command pane now exists, with its wiring done. It opens from a
downward pull on the Lists or Planner header band, or from a two-finger
swipe down. The header's "open commands" button opens it too. The search
takes focus, and the screen behind is inert. Escape, Android back, a
tap outside, the Close button or a pull up closes it. Focus returns
to the opener.

Commands: Add task, Go to Lists, Go to Planner, Switch list, Sort
mode, Theme, Settings and Diagnostics. Add task
opens the focused tab's capture sheet. Switch list is one row, and it
moves to the next tab and wraps.
Theme and Sort mode open the Settings screen instead of repeating its
pickers. Recent commands come first, and the pane caps at 12 rows.

The list scroll, the pager swipe and a row drag never open it. Tests
cover all three. The web suite sends two touch points for the
two-finger swipe. The Android emulator and a phone were not run. Because of that, the
pull feel, the two-finger gesture and TalkBack are still open for the
operator.

Merged as `6fdf38a`. The verifier passed ten checks. It confirmed
`onDeactivate` fires only from `ACTIVE`, so a pan that never activates
cannot open the pane. It also ran the command and lists specs on the
merged head, 68 tests, plus the planner spec, 12 tests.

The verifier also did the 360pt math the 0084 review flagged. The
Planner header leaves 216pt for the mode control. That is about 70pt
per segment, down from 89pt. Every label still fits, and the mode control
keeps at least 44pt. That row is now the tightest in the app, and a
device check is worthwhile.

One cleanup landed on the branch before merge. The search had three
focus paths. Two were identical effects, and the third was the
`SearchFocus` child. Only the child runs after the overlay commits,
so the two effects went away.

One property of an unreached row is worth knowing. The provider caps
the list at 12 before the pane filters it. For that reason, a command past position 12
would also be unreachable by search. Eight commands exist, so the cap
never binds today.
