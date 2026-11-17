# Changelog

What each release adds or changes, in plain words. The newest release
comes first. The same text goes into the GitHub release notes.

## 1.0.0 - 2026-11-20

The first release. It runs on one phone, against one Obsidian vault,
with no server.

### Lists

- Main holds only tasks with no list. A task leaves Main the moment it
  gets a list. Clear the list and the task returns.
- Every tab sorts by due date, by created date, or in My order. My order
  is one flat list for the whole tab, and a drop renumbers the tab.
- Completed tasks sit folded under a Completed header with a count. Tap
  the header to open them. The fold lasts until the app restarts.
- The three-dot menu offers Delete all completed tasks on a tab that has
  some. The confirmation names the count and puts Cancel first. A task
  reopened in Obsidian while the sheet is up stays on disk.
- A tick plays a short ring and dot burst from the circle. It plays only
  when you tick, never on undo, sync or reload. With reduced motion it
  does not draw.
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
  Harsh rings and vibrates. Quiet posts a silent notification.
- Note opens a full editor. The note stays hidden until you open it.
- Every change saves at once, with no Save button.
- If a save fails, the sheet says "Not saved." and offers Retry. Your
  change stays on screen.
- Delete lives in the three-dot menu. Undo shows for five seconds and
  puts back the task, byte for byte.
- The circle next to the title marks the task done.
- Tapping a reminder notification opens its task in the sheet.

### Journal

- A third tab reads today's note at `Journal/Daily/YYYY-MM-DD.md` as a
  ruled page with the time in a left rail.
- Add writes a time and one bullet per line, above the trailing
  `![[daily.base]]` embed. Every earlier byte stays.
- The app creates the note on the first send, never when the tab opens.
- The Food chip writes `- Ate: ... #food`. A quiet band above the bar
  counts the day's food entries and names them.
- A `[[name]]` link opens a read-only preview of
  `References/<name>.md`.
- A retry re-reads the note and never overwrites an edit made elsewhere.

### Planner

- Day shows a timeline over the list for the day. Week fits all seven
  days on one screen, as a spread of two days per row or as seven rows.
  Month shows the month. Each page swipes to its neighbours.
- The middle handle now travels near the top and the bottom of the
  screen. Either pane can grow to almost the whole page.
- A timed due rings at its time. The due time and a reminder in the same
  minute ring once.

### Look and feel

- Four themes: Budget, Todoist, Clay and Midnight. The theme applies at
  once, and the app opens on the last one.
- Icons come from Phosphor, in outline and filled forms. The bottom bar
  is icons only, and each tab keeps its name for TalkBack.
- A keyboard focus ring follows the theme and reads at 3 to 1 or better
  in every palette.
- One spacing and radius scale, guarded by a test, so layout values stop
  drifting.

### Under the hood

- The task note's `list` field, `alert weight` and timed `completed`
  follow the schema contract.
- A crash log stays on the phone after a crash.
- A hidden gallery draws every component in every state, in all four
  themes, at 360 and 412 wide. Open it at Settings, Diagnostics, Open
  gallery.

### Fixes

- Every list tab now shows its tasks to TalkBack and other screen
  readers. Before, only Main did.
