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

The browser build is a preview only. Vault access and notifications need
a device.

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
web build to `dist`, serves it on port 8094, and drives the sample set
with Playwright in `e2e/`. It runs every spec twice: with motion and
with reduced motion. Set `E2E_PORT` to serve on another port, for
example when two checkouts run the suite at once. The run fails if the
port is busy. To test a running `npm run web` instead, use
`npm run e2e:dev`. A failed test keeps a trace in `e2e/test-results`.

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

## Install it on a phone

The `android` workflow builds a sideloadable APK on a GitHub runner,
because a phone needs a native build and the runner already has the
Android SDK. It runs only when you start it. Run it from Actions, or
from the CLI:

```bash
gh workflow run android
gh run watch
gh run download --name monkey-tasks-apk
```

The APK signs with the debug key that `expo prebuild` generates, so
Android asks once for permission to install from the browser or file
manager. The build is a release: JavaScript rides inside the APK, so the app
runs without Metro.

### Develop against a phone without rebuilding

The release APK takes about 45 minutes and cannot load code from Metro.
For day to day work build a development client once, then reload over the
network:

```bash
gh workflow run android -f dev=true
gh run download --name monkey-tasks-dev-apk
```

Install it once. It keeps the vault grant across reloads. Then serve the
bundle, with the host name the phone can reach (a LAN address, or a
Tailscale address when the phone is off the local network):

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=<tailscale-ip> npx expo start --dev-client --lan
```

The dev client opens the URL the CLI prints. A JavaScript change reloads
in a second. A new native module or permission still needs a rebuild.

## Check the vault

The app reads `Tasks/`, `Tasks/Lists/` and `Deeds/`. One command checks
those notes against the schemas, checks every note for a bare
`[[wikilink]]`, and compares the app's frontmatter parse with `js-yaml`:

```bash
npm run vault:check -- /path/to/vault
```

It prints one line per finding, with the file and line. It exits 0
when the vault is clean, 1 when it finds something, and 2 when it
cannot read the path.

A bare link is a `[[link]]` value with no quotes. YAML reads it as a
list, and Obsidian writes the nested form back on the next edit. That
is how `Shop.md` lost its Focus list (ticket 0032). A parser
disagreement is a note where the app and `js-yaml` read the same text
differently, for example `- - Focus`. A note that `js-yaml` cannot
parse counts too, for example a list indented with a tab: the app reads
it, but YAML forbids the tab (ADR 0029). The parser check covers the
app's three folders. The wikilink check covers every note.

## Layout

Routes are thin: `app/(tabs)/planner.tsx` re-exports
`features/planner/PlannerScreen`. A feature owns its model, components,
hooks and pure helpers. Shared UI lives in `components/`, primitives in
`components/ui/`, and the store splits state, actions and selectors
(ADR 0022). `lib/` never imports a feature (ADR 0020).

## Plan

The app is Expo SDK 58 with React Native 0.88 and expo-router, in
TypeScript (ADR 0001). The app reads and writes the vault folder over Android
SAF with `expo-file-system/legacy` (ADR 0002). No backend (ADR 0003).
Notifications fire on the device with `expo-notifications` (ADR 0004).
Capture parses natural-language dates with chrono-node. The app stores recurrence
as a bare RRULE value and expands it with `rrule`.

## Next

Ticket 0047 is the current work: a refactor to the Bulletproof React
layout, a data layer built on mutations, and a motion rebuild on the UI
thread. It lands on the `epic/0047-rebuild` branch through child tickets
0048 to 0063, 0066 and 0068 (ADR 0035). New feature work waits until it
merges.

Open feature tickets after that:

- 0018 a keep-style notes board
- 0039 home screen widgets
- 0065 the list menu actions
- 0003, 0005 and 0008 carry the larger ideas.

The app has two tabs: Lists and Planner. The Lists tab shows Focus and
Main. Main is the catch-all: every task that is not on Focus, including
tasks tagged with a list that has no tab (ADR 0015).

Phases:

1. Spike: bare app reads a task note from the vault folder, edits it, and
   the change appears in Obsidian on desktop after sync (0001).
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
5. Capture: quick capture with offline natural language dates via
   chrono-node and rrule.js. Unparsed lines go to athena agents later
   (0006). Done.
6. Notifications: on-device alarms with recurrence. Wired. The store
   rebuilds the alarm list from the notes after every successful vault
   read, so a capture, a tick, or a drag leaves the schedule matching
   the vault. Ticking a recurring task completes the occurrence and
   creates the next one as its own note (ADR 0027).
7. Later: deed vocabulary cleanup (0005), the quick-task and deed merge
   decision, capture text highlighting (0008), location triggers,
   MCP capture on athena, ntfy fallback, the athena operational dashboard as a possible app surface (idea only), email and calendar
   integrations, pull-only Google Calendar read.
