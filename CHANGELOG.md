# Changelog

What each release adds or changes, in plain words. The newest release
comes first. The same text goes into the GitHub release notes.

Each bullet fits one line on a phone. `scripts/check-changelog.sh`
fails a bullet that wraps or runs past 64 characters.

## 1.4.0 - unreleased

### Deeds

- The app reads your deeds, as tasks with a status.
- A dated deed shows on its day in the planner.
- Main and the lists show plain tasks only.
- A deed with no status waits in the vault, unseen.

### Tabs and lists

- A Today list leads the tabs, due today and past.
- Settings can add or remove the Today list.
- Capture on Today dates the task today.
- The Inbox tab drops its title and keeps the note count.
- A search bar tops the Inbox. It matches titles and note text.
- A button in the bar shows the Inbox as one column or two.
- The Inbox remembers its one or two column choice.
- Swipe right on Add for the next tab, left for the previous.
- The Day, Week, Month and form toggles draw shorter.

### Board

- A Board tab groups your deeds by status.
- Settings can add or remove the Board. It starts off.
- Active, Backlog and Someday stack down the page.
- Done and Dropped fold at the end.
- Drag a deed onto a group to move its status.
- Drag inside a group to set its order.
- A due-date sort turns the board's drag off.
- Done writes the completion date. Leaving Done clears it.
- A deed blocked by an open note shows a red rail.
- Capture on Board makes a backlog deed.

### Speed

- A cold start shows last session's rows at once.
- They stay dim and untappable until the fresh read lands.
- A cold start reads your notes side by side, not in turn.
- It reads a big vault 32 notes at a time, not all at once.
- The first rows show sooner, most with a big vault.

### Reminders

- A reminder is one normal notification. It rings once.
- It uses your phone's sound and follows Do Not Disturb.
- A swipe clears it. It never repeats.
- A task can be an alarm. The editor has one Alarm switch.
- An alarm plays a loud tone and breaks Do Not Disturb.
- Old tasks become normal reminders. No note changes.
- The app drops its old reminder channels on start.
- A reminder has three buttons: Done, Later, Tomorrow.
- They work with the app closed or killed.
- Done ticks the task, and a repeat makes its next note.
- Later moves it an hour on. Tomorrow moves it to 09:00.
- Each one moves the due date and the reminder with it.
- A press that cannot save says so in a notification.
- The app lists a failed press, and can retry it.
- This build adds a native module: install a new APK.

### Fixes

- Done in the reference picker leaves the keyboard up.
- TalkBack hears the theme and week start you picked.
- A dropped row lands without a flash of the old order.

## 1.3.0 - 2026-11-25

### Command pane

- It rises from the bottom edge, as the thumb is.
- Add is one wide button again, with a plus and its word.
- Swipe down on Add to open the commands.
- Swipe left or right on Add to change tab.
- Drag the title down to close it.

### Planner

- The planner's dates follow a swipe, as the tabs do.
- The planner keeps the day you picked.

### Tabs and lists

- The tabs run Lists, Planner, Inbox, Journal.
- My order is the default sort, first in its menu.

### References

- A task can link a note from References.
- Search the folder by note name or ingredient.
- Browse the folder, then tap a note to link it.
- Tap a link on the task to read the note.
- Remove a link from its own row.

### Look and feel

- A new app icon: the monkey, on a banana tile.
- The splash shows the monkey on the same tile.

### Fixes

- A drag under a tick lands where you dropped the row.

## 1.2.0 - 2026-11-19

### Command pane

- Swipe down on the bar's empty middle to open it.
- Add is a split pill now: plus, then ⌘ for commands.
- Go to Journal and Go to Inbox Notes join the list.
- Pull down on Lists and Journal to refresh, as before.
- Reload vault is a command too.

### Planner

- The header drops its chevron and gear.
- The month card you swipe to shows its dates at once.
- Week and Month have the day's divider.
- Weeks start on Monday by default.

### Settings

- Week starts on: Monday or Sunday.

### Look and feel

- A new app icon: a white tick on matcha green.
- The list underline follows your swipe.
- Bigger icons in the bar, headers, rows and chips.
- Inbox Notes and Settings have a line under the header.
- The day's timeline shows a line once hours scroll under.
- Dark status bar icons on the light themes.

### Fixes

- Sheets no longer hide under three-button navigation.
- A sheet sits right above the keyboard.
- Long note names wrap at a hyphen, not mid-word.
- A swipe no longer blinks a blank page as it lands.

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
