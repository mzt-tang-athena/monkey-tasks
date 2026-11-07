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

Android needs the `contracts` submodule checked out. If the folder is
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

The prose rules come from the shared `@mzt-tang-athena/vale-rules`
package. `make lint` runs `npx vale-rules sync` before Vale, which copies
the current rules into `.vale/styles/`. The pack holds the rule files.
The repo-specific suppressions stay in `.vale.ini` (ADR 0035).

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
| `default` | 16 tasks and 9 list notes. `vault:check` finds nothing. |
| `repair` | `Broken note.md` and `Lists/Garden.md`, for the repair block. |

With no `?vault=` in the page address, the preview loads `default`,
then `repair`.

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
| `features/<name>` | The UI of one feature: `capture`, `diagnostics`, `lists`, `planner`, `task-editor`. |
| `components` | Shared UI. `components/ui` holds the primitives. |
| `hooks` | Shared hooks. |
| `stores/tasks` | The task query and one mutation hook per write in `mutations/` (ADR 0037). The failure list, pure row updaters, selectors and the reminder sync. |
| `lib` | Libraries set up for this app: `vault` (the adapter port, its SAF and memory adapters, and the sample notes), `react-query`, `recurrence`, `notifications`, `motion`. |
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
| `Icon` | Every glyph the app draws, by `name` and color token. The app has no icon font. |
| `OverlayHost`, `Overlay` | The root portal in `app/_layout.tsx`. An overlay draws above every screen at its layer. A `modal` overlay hides the screen from assistive tech. |
| `Menu`, `placeMenu` | A menu that opens from an anchor. It flips above near the bottom bar and stays inside the page gutter. |
| `Sheet` | A scrim, a dock that rides the keyboard, and a panel. The scrim and Android back close it. |
| `Banner`, `Toast` | A danger or info message with role `alert`. A toast floats above every other layer. |
| `LoadingState`, `EmptyState`, `ErrorState` | One look for a list that loads, holds nothing or fails. |
| `SectionHeader` | An eyebrow label over a group, with a count and a tone. |
| `CardGroupRow` | One row of a group card, with its edges and an inset divider. |
| `TabStrip`, `SegmentedControl` | Tabs that scroll, with a fade over an edge that hides more tabs, and segments. Every target is at least 44 by 44. |
| `TextField` | A labelled input, with a hint or an error. |

`components/task-row-face` draws the still task row that `TaskRow` and
`PreviewRow` share. `hooks/use-dismiss` closes a surface on Android
back and on Escape in the browser. `hooks/use-press-guard` blocks the
click that ends a swipe or a drop. `hooks/use-stable-callback` gives a
handler one identity for a memoized row (ADR 0043). `theme/tokens.ts`
holds the type scale, the layer order and the shadows (ADR 0040).

### Planner

`features/planner` is a composition root (ADR 0025). The pieces:

| Piece | Holds |
|---|---|
| `planner-screen.tsx` | Route and store reads, the list context, the overlays, the layout. |
| `planner-layout.ts` | The shared frame and pane styles. Every other style sits next to its component. |
| `components/planner-list-context.tsx` | What every task list shares: the source, the form, the lift and the row actions. |
| `components/day/` | The day. It holds the spread, the page, the timeline and list panes, and the split handle. It also holds the overdue group and the swipe preview. |
| `components/week-pane.tsx`, `month-pane.tsx` | The week and month bodies. |
| `hooks/use-drag-session.ts` | Drag for all three modes: hold, lift, ghost, touch gate, click guard and drop (ADR 0025). |
| `hooks/use-planner-gestures.ts` | What each drop zone means, the guarded presses, and the day and month shifts. |
| `hooks/use-split-pane.ts`, `use-planner-source.ts` | The day's split sizes, and the source and its chooser. |
| `lib/day-rows.ts` | The rows of a day, as pure functions. The live day, the swipe preview and the month's picked day read them. |

`hooks/use-today` gives one start-of-day date that moves on at midnight
and when the app returns to the foreground. The planner route and every
period label read it. A week column shows the chips that fit and a
"+N more" line (ADR 0041).

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

Ticket 0047 is the current work. It moves the app to the Bulletproof
React layout and builds the data layer on mutations. It also rebuilds
the motion on the UI thread. It lands on the `epic/0047-rebuild` branch through child tickets
0048 to 0063, 0066 and 0068 (ADR 0035). New feature work waits until it
merges.

Open feature tickets after that:

- 0018 a keep-style notes board
- 0039 home screen widgets
- 0065 the list menu actions
- 0003, 0005 and 0008 carry the larger ideas.

The app has two tabs: Lists and Planner. The Lists tab shows Focus and
Main. Main is the catch-all. It holds every task not on Focus,
including tasks tagged with a list that has no tab (ADR 0015).

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
   note viewer (0003, children 0009 to 0013). In progress. Lists and
   Planner exist. The task editor and note viewer do not.
5. Capture: quick capture with offline natural language dates. It uses
   chrono-node and rrule.js. Unparsed lines go to athena agents later
   (0006). Done.
6. Notifications: on-device alarms with recurrence. Wired. The store
   rebuilds the alarm list after every successful vault read. A capture,
   a tick, or a drag leaves the schedule matching the vault. Ticking a
   recurring task completes the occurrence. It creates the next one as
   its own note (ADR 0027).
7. Later: deed vocabulary cleanup (0005), the quick-task and deed merge
   decision, and capture text highlighting (0008). Location triggers,
   MCP capture on athena, ntfy fallback, and the athena operational
   dashboard as a possible app surface (idea only). Email and calendar
   integrations, and pull-only Google Calendar read.
