# Changelog

What each release adds or changes, in plain words. The newest release
comes first. The same text goes into the GitHub release notes.

Each bullet fits one line on a phone. `scripts/check-changelog.sh`
fails a bullet that wraps or runs past 64 characters.

## 1.2.0 - 2026-11-18

### Planner

- The month card you swipe to shows its dates at once.
- Week and month lists sit under the day's divider.
- Weeks run Monday to Sunday, and the month grid follows.

### Settings

- Week starts on: Monday, or Sunday.

### Fixes

- A sheet sits 8pt above the keyboard, with no gap.
- A pager no longer blinks blank when a swipe lands.

### Look and feel

- A header carries a hairline where content scrolls under it.
- The day's timeline shows its line once hours pass under it.

## 1.1.0 - 2026-11-18

### Inbox Notes

- New tab: the notes in your vault's `Inbox/` as cards.
- Two columns, newest first.
- A stamp name like `202611181230` shows as a date.
- Add is one text box: type and send.
- Tap a card to edit the note.
- A save never overwrites an edit made in Obsidian.
- A failed save keeps your draft, with Retry.

### Look and feel

- Slimmer tabs, so four tabs and Add fit a small phone.

### Fixes

- The tick's burst no longer paints over the bottom bar.

## 1.0.0 - 2026-11-18

The first release. One phone, one Obsidian vault, no server.

### Lists

- Main holds the tasks that have no list.
- Sort by due date, created date or My order.
- In My order, drag to reorder the whole tab.
- Completed tasks fold under a Completed header.
- The three-dot menu deletes all completed tasks.
- A tick plays a short burst. Reduced motion skips it.

### Task editor

- A task opens in a sheet over the list.
- Close it with a tap outside, back, or a drag down.
- Set fields show as tiles. Empty ones show as buttons.
- Due: Today, Tomorrow, Next week, a month or a time.
- Repeat: daily to yearly, or your own rule.
- Pick a list, or Main for none.
- Reminders, each Harsh (rings) or Quiet (silent).
- A full editor for the task's note.
- Every change saves at once. A failed save offers Retry.
- Delete from the three-dot menu, with 5 seconds to undo.
- A reminder notification opens its task.

### Journal

- A tab for today's note in `Journal/Daily/`.
- Each entry gets a time. Earlier text never changes.
- The note appears on your first entry.
- The Food chip logs a meal. A band counts the day's meals.
- A `[[link]]` opens a read-only preview.

### Planner

- Day: a timeline over the day's list.
- Week: all seven days on one screen, in two layouts.
- Month: the whole month.
- Swipe to the next day, week or month.
- Drag the middle handle to grow either pane.
- A timed task rings at its time.

### Look and feel

- Four themes: Budget, Todoist, Clay and Midnight.
- Phosphor icons. The bottom bar is icons only.
- A keyboard focus ring in every theme.

### Under the hood

- Task fields follow the vault's schema contract.
- A crash log stays on the phone.
- A component gallery in Settings, Diagnostics.

### Fixes

- Screen readers now see the tasks on every list tab.
