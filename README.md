# monkey-tasks

Personal tasks, reminders, and calendar, built on the Obsidian vault. The
phone vault folder `Documents/obsidian-vault` is the store. The app is a
standalone Android app. See `docs/adr/` for the decisions and
`tickets/open/` for the queue, with `doing/` and `done/` beside it.

## Run it

Install the root dependencies from the repo root:

```bash
npm ci
```

Every install needs the `contracts` submodule checked out, because the
app builds the pinned schemas package during `npm ci`. If the folder is
empty, run `git submodule update --init` at the repo root first.

Install the app dependencies from `app`:

```bash
cd app
npm ci
```

Start the Android build, or the browser preview:

```bash
npm run android
npm run web
```

The browser build is a preview only. It runs on a memory vault, seeded
from sample notes. It runs the same write path as the phone (ADR 0037).
Its changes last until the page reloads. Notifications need a
device. See [The preview's vault](#the-previews-vault).

Run the app tests from `app`:

```bash
npm test
```

Vitest runs two projects (ADR 0038). `npm run test:unit` runs the logic
tests in node. `npm run test:component` renders components through
React Native Web in jsdom.

Run the end-to-end tests from `app`:

```bash
npx playwright install chromium
npm run e2e
```

The first command fetches the browser once. `npm run e2e` exports the
web build to `dist` with the vault test hooks on. It serves the build on
port 8094 and drives the sample set with Playwright in `e2e/`. It runs
every spec twice: with motion and with reduced motion. Set `E2E_PORT`
to serve on another port, for example when two checkouts run the suite
at once. The run fails if the port is busy. To test a running
`npm run web` instead, use `npm run e2e:dev`. A failed test keeps a
trace in `e2e/test-results`.

To prove one change by hand, agents use the project skill in
`.claude/skills/verify-monkey-tasks/`. It serves the preview on its own
port and runs journey files on the same helpers. It keeps screenshots,
traces and note text in `app/build/verify/evidence/`.

The same skill runs a release APK on an Android emulator. That covers
motion, gestures and the vault grant, which the preview cannot show. It needs the
Android SDK in `~/Android/Sdk` and KVM. Its Android section has the
steps, and it says what still needs the phone.

Run the schema tests from `contracts/packages/schemas`:

```bash
npm test
```

## Commit checks

Install the local hook once per clone:

```bash
make hooks
```

It runs ESLint on the staged app code in `src`, `scripts` and `e2e`,
and Vale on the staged docs. An ESLint warning fails the commit. The
typecheck, the tests and the bundle stay in CI.

A staged rename counts as a staged file. A ticket close moves the
ticket and edits it in one commit, so the hook must read it.
`make test-pre-commit` proves that it does.

The prose rules come from the shared `@mzt-tang-athena/vale-rules`
package. `make lint` runs `npx vale-rules sync` before Vale, which copies
the current rules into `.vale/styles/`. The pack holds the rule files.
The repo-specific suppressions stay in `.vale.ini` (ADR 0044).

`write-good` comes from the release zip in `.vale.ini`'s `Packages` line.
`scripts/sync-vale-packages.sh` fetches it once per version, and
`make lint` runs that script first.

## Install it on a phone

The `android` workflow builds a sideloadable APK on a GitHub runner. A
phone needs a native build, and the runner already has the Android SDK.
It runs only when you start it. Run it from Actions, or from the CLI:

```bash
gh workflow run android
gh run watch
gh run download --name monkey-tasks-apk
```

The APK signs with the debug key that `expo prebuild` generates.
Android asks once for permission to install from the browser or file
manager. The build is a release: JavaScript rides inside the APK, so
the app runs without Metro.

`CHANGELOG.md` lists what each release adds or changes, in plain words.
Each GitHub release repeats its section.

### Cut a release

`scripts/release.sh <version>` runs the eight release steps in order.
Releases 1.0 to 1.2 ran them by hand. A local script beat release-it,
semantic-release and EAS. The app has no store listing and no npm
package. The smoke must pass before we publish
(ADR `20261121-one-script-runs-a-release`).

1. Set `expo.version` in `app/app.json`.
2. Date the section for the version in `CHANGELOG.md`.
3. Land both through a pull request and merge it.
4. Pull main, run `scripts/gate.sh full` and wait for the receipt.
5. Run `scripts/release.sh <version>`.

It refuses unless main is clean, checked out and level with
`origin/main`. The app version must match. The changelog section needs a
date for the release. A full gate receipt must also pass for HEAD. It
lists merged PRs since the last tag with no changelog line. It stops
when one changed app code a user can see.

Then it:

- tags the gated commit.
- builds for every CPU type.
- copies the APK and its checksum to the archive.
- runs the release smoke on the emulator.
- cuts the notes from the tag's changelog.
- pushes the tag and makes the GitHub release.
- downloads it and checks the APK against the checksum.

A failing smoke stops it before the release, and it exits non-zero.

If the download check fails, the release is already live. The script
exits 1, names the mismatch, and prints the `gh release edit --draft` and
`gh release delete` commands. It does not retract the release.

```bash
scripts/release.sh 1.3.0 --dry-run     # print every step, change nothing
scripts/release.sh 1.3.0 --no-publish  # rehearse the local steps
scripts/release.sh 1.3.0               # the real release
```

`--no-publish` makes the tag only in this clone. It stops before the
push and the release, then deletes the tag. `RELEASE_ARCHIVE` moves the
output folder, which defaults to
`~/code/monkey-tasks/archive/release-<version>`.

### Build the release APK on this machine

When Actions has no minutes, or when a build should not leave the
machine, build the same APK here. This machine holds the Android SDK,
JDK 17 and an emulator under `~/Android`.

```bash
export JAVA_HOME=~/Android/jdk ANDROID_HOME=~/Android/Sdk
cd app
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
```

The APK lands at `app/android/app/build/outputs/apk/release/app-release.apk`.

### Develop against a phone without rebuilding

The release APK takes about 45 minutes and cannot load code from Metro.
For day to day work build a development client once, then reload over the
network:

```bash
gh workflow run android -f dev=true
gh run download --name monkey-tasks-dev-apk
```

Install it once. It keeps the vault grant across reloads. Then serve the
bundle with the host name the phone can reach. Use a LAN address, or a
Tailscale address when the phone is off the local network:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=<tailscale-ip> npx expo start --dev-client --lan
```

The dev client opens the URL the CLI prints. A JavaScript change reloads
in a second. A new native module or permission still needs a rebuild.

## Check the vault

The app reads `Tasks/`, `Tasks/Lists/` and `Deeds/`. One command checks
the notes against the schemas and checks every note for a bare
`[[wikilink]]`. It also compares the app's frontmatter parse with
`js-yaml`:

```bash
npm run vault:check -- /path/to/vault
```

It prints one line per finding, with the file and line. It exits 0
when the vault is clean, and 1 when it finds something. It exits 2
when it cannot read the path.

A bare link is a `[[link]]` value with no quotes. YAML reads it as a
list, and Obsidian writes the nested form back on the next edit. That
is how `Shop.md` lost its Focus list (ticket 0032). A parser
disagreement is a note where the app and `js-yaml` read the same text
differently, for example `- - Focus`. A note that `js-yaml` cannot
parse counts too. One example is a list indented with a tab. The app
reads it, but YAML forbids the tab (ADR 0029). The parser check covers the
app's three folders. The wikilink check covers every note.

## The preview's vault

Every file call goes through one `VaultAdapter` port in `src/lib/vault`
(ADR 0037). Android uses the SAF adapter. The browser preview, the
component tests and Playwright use the memory adapter.

The preview seeds the memory adapter from the sample notes in
`src/lib/vault/sample/<seed>/`. The note dates count from 2026-10-26.
The preview moves every frontmatter date forward by the days since
then. That keeps every group on the list full.

| Seed | Holds |
|---|---|
| `default` | 16 tasks, 9 list notes, one journal day and one reference. `vault:check` finds nothing. |
| `repair` | `Broken note.md` and `Lists/Garden.md`, for the repair block. |
| `inbox` | Seven `Inbox/` notes with the name shapes the cards must read. |

With no `?vault=` in the page address, the preview loads `default`,
then `repair`, then `inbox`.

Metro cannot import a `.md` file, so the notes reach the app through
the generated `sample/index.ts`. After a change to a sample note, run
this from `app`:

```bash
npm run sample:build
```

A test fails when `index.ts` is out of date with the notes.

### Test hooks

A dev build has the vault test hooks. A build made with
`EXPO_PUBLIC_VAULT_TEST_HOOKS=1` has them too, and `npm run web:export`
sets that flag. A release APK has neither. A build without hooks
ignores the page query, and `globalThis.__vault` stays undefined.

| Page query | Effect |
|---|---|
| `?vault=<seed>` | Load these seeds, as a comma list. `?vault=` loads an empty vault. |
| `?latency=<ms>` | Delay every vault call. |
| `?fail=<call>:<file name>` | Fail the next call of this kind on this file. The calls are `list`, `findFolder`, `makeFolder`, `read`, `write`, `create` and `remove`. |

`globalThis.__vault` reaches the same vault from a test:

| Member | Effect |
|---|---|
| `files()` | Every file, by path: `"Tasks/Call Mum.md"` to its text. |
| `read(path)` | The text of one file, or null. |
| `write(path, text)` | Write a file and its folders, as another app would. |
| `reset(seed)` | Replace every file with a seed name, a comma list of seeds, or a map of files. |
| `setLatency(ms)` | Delay every later call. |
| `failNext(call, name)` | Fail the next call of this kind on the file with this name. |

## Layout

The app code in `app/src` follows the Bulletproof React layout
(ADR 0039).

| Folder | Holds |
|---|---|
| `app` | expo-router routes and the providers. A route re-exports one screen or composes features in a few lines. |
| `features/<name>` | The UI of one feature: `capture`, `command`, `diagnostics`, `inbox-notes`, `journal`, `lists`, `planner`, `task-editor`. |
| `components` | Shared UI. `components/ui` holds the primitives. |
| `components/motion` | The motion surfaces (ADR 0046): `Pager`, `createDragSurface`, `Split`, `Landing`, `MotionScrollView` and the tick's `Celebration`. `ScrollEdge` is the hairline where content scrolls under a header. `TabUnderline` tracks a `Pager` through the `PageFollow` its screen creates. They own every gesture, worklet and thread crossing, so a feature passes data and plain functions. `internal/` is private to the folder. |
| `hooks` | Shared hooks. |
| `stores/tasks` | The task query and one mutation hook per write in `mutations/` (ADR 0037). The failure list, pure row updaters, selectors and the reminder sync. |
| `stores/journal` | The daily note query, the reference read and the append mutation. It shares the vault scope and reads no task state. |
| `stores/inbox-notes` | The Inbox query and its create and save mutations. It shares the vault scope and reads no task state. |
| `lib` | App libraries with no feature knowledge. `vault` holds the adapter port, its SAF and memory adapters, and the sample notes. `journal` holds the note grammar and file I/O. `inbox-notes` holds the card model and the Inbox file I/O. `react-query`, `recurrence`, `notifications` and `alerts` hold their own setup. `lib/motion` holds the motion tokens, the pure worklet math with its tests, and the clocks (`timing`, `spring`, `useProgress`). |
| `types` | Shared types, such as `TaskItem`. |
| `utils` | Pure helpers: dates, YAML, schema errors. |
| `theme` | Design tokens. |
| `testing` | Test setup and regression tests that cross layers. |

Inside a feature, `components/` holds its UI, `hooks/` its stateful
glue, `lib/` its pure helpers and `model.ts` its rules (ADR 0022).

### Shared UI

`components/ui` holds the primitives that the screens share. Each file
documents its props, and each primitive has a component test.

| Primitive | What it draws |
|---|---|
| `Button` | A solid or quiet pill, a round send control, or a `text` label at least 44 pt high. |
| `IconButton`, `Pill` | An icon in a 44 pt target. A control pill, or a `chip` that reads a parsed field. |
| `Icon` | Every glyph the app draws, from Phosphor's path data (ADR 20261117-phosphor-glyphs). `name`, a palette color and an optional `size` that centers it in a square box beside text. Every name has an outline and a fill drawing, so a selected control can switch weight. |
| `OverlayHost`, `Overlay` | The root portal in `app/_layout.tsx`. An overlay draws above every screen at its layer. A `modal` overlay hides the screen from assistive tech. |
| `Menu`, `placeMenu` | A menu that opens from an anchor. It flips above near the bottom bar and stays inside the page gutter. |
| `Sheet` | A scrim, a dock that rides the keyboard, and a panel. The scrim and Android back close it. A `stacked` sheet draws over another sheet, and a `covered` one waits under it. |
| `CommandPane` | A searchable command list that slides down from the top edge. The screen behind is inert. |
| `Banner`, `Toast` | A danger or info message with role `alert`. A toast floats above every other layer. |
| `LoadingState`, `EmptyState`, `ErrorState` | One look for a list that loads, holds nothing or fails. |
| `SectionHeader` | An eyebrow label over a group, with a count and a tone. With `expanded` and `onPress`, the row is a 44pt disclosure that opens the group. |
| `CardGroupRow` | One row of a group card, with its edges and an inset divider. |
| `TabStrip`, `SegmentedControl` | Tabs that scroll, with a fade over an edge that hides more tabs, and segments. Every target is at least 44 by 44. With a `PageFollow`, the selected rule tracks the pager's swipe. |
| `EdgeFade` | The stepped fade over the edge of a sideways strip that hides more items. The tab strip and the editor's add strip share it. |
| `Pressable` | Every press target. React Native's press on the web, because it takes the browser click. A row that mounts or re-renders under the finger still presses. It needs no layout report. Gesture handler's on native, where a pan cancels it. A surface swallows the one click a pan activation leaves behind. A web keyboard focus draws the shared focus mark, in the active palette. |
| `TextField` | A labelled input, with a hint or an error. |

`components/task-row-face` draws the still task row that `TaskRow` and
`PreviewRow` share. `hooks/use-dismiss` closes a surface on Android back
and on Escape in the browser. `hooks/use-press-guard` blocks the
click that ends a swipe or a drop. `hooks/use-stable-callback` gives a
handler one identity for a memoized row (ADR 0043). `theme/palettes.ts`
holds the named palettes. `theme/tokens.ts` holds the type scale, the
layer order and the shadows (ADR 0040). `theme/theme-provider.tsx` owns
the active palette (ADR 20261111-runtime-theme-provider). A component
keeps its styles in a `makeStyles(palette)` factory. It reads them
through `useThemedStyles`. A theme switch then repaints it in place.
The root layout draws the status bar in the palette's icon colour.
`lib/settings-store.ts` holds the live sort order, task form, week
view and week start for the mounted Lists and Planner screens.
`features/settings` is the one screen that writes the palette and
those settings (ADR 20261111-settings-screen). A week runs Monday to
Sunday by default, and Settings lets you pick Sunday (ADR
`20261118-week-start-setting`). Lists opens it from the list menu, and
the command pane opens it from every tab. Its Diagnostics section
reads the crash log from app storage and offers Copy and Share (ticket
0081). It opens the diagnostics screen, which holds the one link to the
gallery.

`features/gallery` draws every primitive in every state, in the active
palette (ADR 20261112-component-gallery). Its route is `/gallery`. A
reviewer reaches it from Diagnostics only. `model.ts` holds the state
matrix, and the Playwright spec walks the same list. Its Icons section
draws every glyph in both weights at its real size.

### Icons

`components/ui/icon.tsx` draws Phosphor's path data through
`react-native-svg`. The generator writes the table in
`components/ui/glyphs.ts`.
Add a glyph to the map in `scripts/icons/build.ts`, then run this from
`app`:

```bash
npm run icons:build
```

A test fails when the table is out of date with `@phosphor-icons/react`.

`features/task-editor` is the task editor (ADR
20261116-task-editor-sheet). A row press on Lists or Planner opens it,
through `hooks/use-task-editor.tsx` and the provider in
`app/_layout.tsx`. It draws as a bottom sheet over the screen. It shows
the list, the title, and one control per property. A property with a
value is a tile. One without is a chip in the add strip. `model.ts` is
the property registry: Due, Repeat, Alerts and Note. Reference (ticket
0091) joins it as one more entry. The Alerts picker also holds the
task's alert weight, Harsh or Quiet.

Each committed change writes at once. `lib/session.ts` is the session
reducer and its queue: one write per task, last draft wins, and a
failure keeps the draft. `lib/when.ts` and `lib/recurrence.ts` turn
dates and rules into plain words. A picker is a second sheet stacked
over the editor. Delete sits in the sheet's menu and shows a toast
with Undo. An alert tap pushes the `/task/[id]` route. For a task, the
route opens the editor sheet and steps back. For any other note, it
shows the read-only viewer.

`features/command` holds the command pane that ticket 0085 adds
(ADR 20261111-command-pane). A downward swipe on the bottom bar's gap,
or the bar's Command half, drops it from the top edge. The search takes
focus, and a row runs one action and closes the pane. The screen
behind is inert. No tab, pill or list body starts the gesture, so a
pull on a list body only scrolls or refreshes. "Reload vault" rereads
every vault query. A Go to row reaches each of the four tabs. Theme and
Sort mode open Settings rather than repeat its pickers.

### Planner

`features/planner` is a composition root (ADR 0025). The pieces:

| Piece | Holds |
|---|---|
| `planner-screen.tsx` | Route and store reads, the list context, the overlays, the layout. |
| `planner-layout.ts` | The shared frame and pane styles. Every other style sits next to its component. |
| `components/planner-list-context.tsx` | What every task list shares: the source, the form and the row actions. |
| `components/day/` | The day. It holds the spread, the page, the timeline and list panes, and the day split. It also holds the overdue group and the swipe preview. |
| `components/week-pane.tsx`, `month-pane.tsx` | The week and month bodies. Week puts its day boxes in the shared pager. Both put the card over the list with `SplitFit`, the day's divider held still. |
| `components/week-view.tsx` | The week body in both layouts, Spread and Rows. A static twin draws the pager's neighbour page. |
| `lib/week-body.ts` | The seven days, the chip count, and the table of each layout's grid cells. |
| `lib/plan-drag.ts` | The planner's one drag surface: the targets, the ghost payload and the pure drop patch. |
| `hooks/use-planner-gestures.ts` | The day and month shifts, until 0059 moves the pagers. |
| `hooks/use-planner-source.ts` | The source and its chooser. |
| `lib/day-rows.ts` | The rows of a day, as pure functions. The live day, the swipe preview and the month's picked day read them. |

`hooks/use-today` gives one start-of-day date that moves on at midnight
and when the app returns to the foreground. The planner route and every
period label read it. A week day box shows two chips and a "+N" count
(ADR 0041, ADR 20261114-week-planner-fits-one-screen).

### Journal

`features/journal` shows today's daily note as a ruled page. It reads
`Journal/Daily/YYYY-MM-DD.md` and appends to it. It never rewrites a line.

| Piece | Holds |
|---|---|
| `journal-screen.tsx` | The day's query, the page, the header and the bottom bar's action slot. |
| `components/journal-dock.tsx` | The Add button, the entry sheet and the failure toast. |
| `components/entry-form.tsx` | The multiline field, the Food chip and the send control. |
| `components/journal-header.tsx` | The month and today's food count. The seat for later stats. |
| `components/journal-heading.tsx` | The day's serif title and its accent rule, at the top of the page. |
| `components/journal-paper.tsx` | The ruled page, the blocks and the landing mark. |
| `components/reference-sheet.tsx` | A read-only look at `References/<name>.md`. |
| `hooks/use-entry-draft.ts` | The draft, the send and the retry. |
| `hooks/use-journal-sheet.ts` | The sheet's clock, the Food chip and the failure toast. |
| `lib/labels.ts` | The date, the food stat name and the failure words. |

`lib/journal/format.ts` holds the note grammar as pure functions. A block
is a line that is only `HH:MM` and the `- ` bullets under it.
`planAppend` builds the next text and keeps every existing byte.
`lib/journal/daily-note.ts` is the only file that reads and writes the
note. A read never creates. The first send makes the folders and the
note, with no frontmatter and no embed. A retry re-reads, so an edit from
Obsidian is never clobbered.

A food entry is `- Ate: ... #food` inside a block. The `#food` tag is the
machine marker, and the `Ate:` prefix is for the eye. A fixed header
shows the month and today's food count. The day is the page's serif
title. The labels stay on the page, and the header is the seat for
calories and other numbers later. The marker is provisional (ADR
20261112-journal-format).

The journal does not use the task store. Its append shares `VAULT_SCOPE`
with the task writes, so the vault takes one write at a time. The append
stays out of the Lists failure banner.

### Inbox Notes

`features/inbox-notes` shows the notes in `Inbox/` as a two-column card
grid, newest first. It reads no task state and does not use the task
store. The tab's action is the note composer.

| Piece | Holds |
|---|---|
| `inbox-notes-screen.tsx` | The read, the grid, the header and the bottom bar's action slot. |
| `note-editor-screen.tsx` | The body-only editor and its conflict notice. |
| `components/note-card.tsx` | One card: the name as the title and the body as the preview. |
| `components/note-dock.tsx` | The Add button, the note sheet and the failure toast. |
| `components/note-form.tsx` | The body field, the optional title and the send control. |
| `hooks/use-note-sheet.ts` | The sheet's clock, the draft and the failure toast. |

`lib/inbox-notes/model.ts` holds the name and preview rules as pure
functions. A bare `YYYYMMDDHHmm` name shows as a local date and time.
Every other name shows exactly as written, so a slug or a sentence
keeps its words. A card shows up to eight lines of the body with the markdown
marks gone and the indentation flattened. A long name wraps after a hyphen,
never inside a word. `lib/inbox-notes/read-inbox.ts`
lists, reads, creates and saves the notes. A read never makes the
folder; the first capture does.

A save writes the body below the frontmatter through
`writeNoteIfUnchanged`. A conflict keeps the draft and offers Save a
copy, Reload note and Keep editing. ADR `20261117-inbox-note-model`
records the model.

Imports follow four zones:

1. A feature imports no other feature.
2. A feature imports nothing from `app`.
3. The shared folders import no feature and nothing from `app`. The
   shared folders are `components`, `hooks`, `lib`, `stores`, `theme`,
   `types` and `utils`.
4. `lib`, `utils`, `types` and `theme` import nothing from
   `components`, `hooks` or `stores`.

An import that leaves its folder uses the `@/` alias. File and folder
names use kebab-case, except the route files under `app`. A module
imports the file it needs, not a barrel file. ESLint checks the zones
with `import/no-restricted-paths` and the names with
`eslint-plugin-check-file`.

## Plan

The app is Expo SDK 58 with React Native 0.88 and expo-router, in
TypeScript (ADR 0001). The app reads and writes the vault folder over
Android SAF with `expo-file-system/legacy` (ADR 0002). Every call goes
through one vault adapter port (ADR 0037). No backend (ADR 0003).
Notifications fire on the device with `expo-notifications` (ADR 0004).
Capture parses natural-language dates with chrono-node. The app stores recurrence
as a bare RRULE value and expands it with `rrule`. A monthly task due after
the 28th gets a month-end rule. That rule gives it a due date in every
month (ADR 0042).

## Next

Version 1.0 ships the week of 2026-11-16. A tick now draws a short
burst from the checkbox, in the active palette (ADR
20261116-completion-celebration). Every tick control plays it, the
editor sheet's included, and only when the press marks the task done.

The launcher icon is a flat matcha tile with a white tick (ADR
`20261118-app-icon`). The sources live in `app/scripts/app-icon/source/`,
and `npm run app-icon:build` rebuilds every icon asset from them.

The design direction round started. `20261112-design-scale-guard`
merged in `d26fcae`. It names the spacing and radius scale, moves
fifteen stray values onto it, and adds a vitest guard. The guard fails a
raw padding, margin, gap or radius of 4 or more in features, components
and app routes. The component gallery merged in `68fb1a4`, ticket
`20261112-component-gallery`. It draws every primitive in every state,
in all four palettes, at 360 and 412 wide. A Playwright spec checks
names, the 44pt floor and axe in each palette. It keeps one review
screenshot per palette and width. The gallery found two defects.
`20261112-menu-hint-name` fixes the first: a hinted menu item now reads
as one name, and the gallery draws a hint again. `20261112-control-focus-ring`
fixes the second. The shared press draws one focus mark for a keyboard
focus, in every palette. The gallery's focus cells follow the keyboard
(ADR 20261112-control-focus-ring). Ticket 0082 settled the selected
state recipe. Icon buttons carry their state in the glyph. They draw
outline at rest and filled when selected, with no box behind the
button (PR 148). The week drop target draws a 2pt ink ring inside the
day box. The gap between boxes stays paper (ADR 20261114).

The phase 4 rebuild merged in `b3acdb1`. The round of tickets 0080 to
0087 finished. It fixed the crash after a tick and the pager remount.
It added runtime themes, a settings screen, a crash log and a command
pane. It also moved reorder to the grip only. Ticket 0082 shipped both
halves of its pick, the icon glyphs and the week drop ring.

The operator decided the schema review, 0094. Its remaining work is
three child tickets:

- `20261111-a-timed-due-rings`, in review
- `20261111-completed-takes-a-time`
- `20261111-kind-accepts-both-shapes`

The feature queue:

- 0088 the journal tab, built with 0089 and 0090 in PR #143
- 0091 reference notes on a task
- 0092 optional quests and evergreen tasks, a discovery. The
  findings and mockups wait on the operator's pick
- 0093 the task editor rebuild, shipped in #155. The phone pass for
  keyboard insets and Android back remains
- 0095 the Inbox Notes tab, shipped in #164. The phone pass for
  TalkBack on the four tabs and the note composer remains
- 20261111 reminder weight shipped in #150, #152 and #153. The phone check
  remains (20261111-alert-weight-device-check)
- 20261111 one list and a whole-tab order, decided. The children:
  - one list field on the task note
  - Main holds the unfiled tasks
  - order the whole tab
  - pick one list in the editor, shipped in #155
- 20261111 fold deeds into tasks, a spike
- 20261117 Phosphor glyphs and an icon-only nav, in review

Open feature tickets:

- 0039 home screen widgets
- 0065 the list menu actions
- 0003, 0005 and 0008 carry the larger ideas.

The app has four tabs today, Lists, Planner, Journal and Inbox Notes. The bar
carries no labels; each tab's name lives in its accessibility label
(ADR 20261117-phosphor-glyphs). The bar's action is a split Add pill.
Its plus half runs the tab's Add. Its Command half opens the pane
(ADR 20261111-command-pane). A downward swipe on the empty gap between
the tabs and the pill opens the pane too. Both halves are 44pt, so
four tabs and the pill fit a 360pt screen. The Lists tab
shows Main and the list notes. Main holds the tasks with no list. Any
other tab shows the tasks whose `list` carries that name. My order makes
each tab one flat list (ADR 0015 and its 2026-11-11 amendment,
`20261111-one-list-and-tab-order`). The Journal tab shows today's note
and appends to it.

Each list tab folds its Completed group by default. The header keeps
the count and opens or closes on a tap. It turns on the app's shared
clock. The fold is session state per tab, so a restart folds every tab
again (ADR `20261116-fold-and-clear-completed`).

The list menu's Delete all completed tasks asks first and names the
count. It removes the done notes of the tab it opened from, one note at
a time. It reads each note again before the delete, so a note another
app reopened while the sheet was up stays. A note the app cannot delete
comes back too, and the banner says how many stayed. The app keeps no
trash and no undo, so the delete is final. Obsidian sync sees the
removed files and syncs the deletion.

The vault now serves more than `Tasks/`. The journal appends to
`Journal/Daily/YYYY-MM-DD.md`, and the reference picker reads
`References/`.

Phases:

1. Spike: bare app reads a task note from the vault folder and edits it.
   The change appears in Obsidian on desktop after sync (0001).
2. Vault vocabulary: lightweight task notes in `Tasks/`, list notes in
   `Tasks/Lists/`, deeds unchanged. The app derives done from a
   `completed` date; reminders are a list; recurrence is an RRULE
   string (0004).
3. Schema package: Zod models for task, deed, and list notes mirroring
   the vocabulary (0002, ADR 0005). Done. The package lives in the
   central contracts repo (0007, ADR 0007).
4. MVP screens: focus list, upcoming reminders, calendar, task editor,
   note viewer (0003, children 0009 to 0013). In progress. Lists,
   Planner and Journal exist, and the task editor sheet shipped in
   #155. The note viewer shows a note without edits.
5. Capture: quick capture with offline natural language dates. It uses
   chrono-node and rrule.js. Unparsed lines go to athena agents later
   (0006). Done.
6. Notifications: on-device alarms with recurrence. Wired. The store
   rebuilds the alarm list after every successful vault read. A capture,
   a tick, or a drag leaves the schedule matching the vault. Ticking a
   recurring task completes the occurrence. It creates the next one as
   its own note (ADR 0027). An alert uses its task's `alert weight`. A
   harsh alert rings on the alarm stream and escalates at 1, 5 and 15
   minutes. A quiet one rings once in silence. A tap or a tick clears
   the group (ADR 20261111-reminder-weight).
7. Later: deed vocabulary cleanup (0005), the quick-task and deed merge
   decision, and capture text highlighting (0008). Location triggers,
   MCP capture on athena, ntfy fallback, and the athena operational
   dashboard as a possible app surface (idea only). Email and calendar
   integrations, and pull-only Google Calendar read.
