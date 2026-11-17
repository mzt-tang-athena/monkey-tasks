# Changelog

What each release adds or changes, in plain words. The newest release
comes first. The same text goes into the GitHub release notes.

## Unreleased

### Task editor

- Tapping a task opens a sheet over the list instead of a new screen.
  To close it, tap outside it, press back, or drag its top edge down.
  The same drag closes every picker and the add task sheet.
- Properties with a value show as tiles. The ones without a value show
  as buttons in a row at the bottom. Tap either to change it.
- Due has Today, Tomorrow and Next week, a month grid and a time.
- Repeat has Daily, Weekdays, Weekly, Monthly and Yearly. Advanced takes
  a repeat rule and shows the next three dates.
- The list button at the top picks one list, or Main for none.
- Alerts holds any number of reminders and the Harsh or Quiet choice.
- Note opens a full editor. The note stays hidden until you open it.
- Every change saves at once, with no Save button.
- If a save fails, the sheet says "Not saved." and offers Retry. Your
  change stays on screen.
- Delete lives in the three-dot menu. Undo shows for five seconds and
  puts back the task, byte for byte.
- The circle next to the title marks the task done.
- Tapping a reminder notification opens its task in the sheet.

### Fixes

- Every list tab now shows its tasks to TalkBack and other screen
  readers. Before, only Main did.
