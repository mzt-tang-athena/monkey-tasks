# monkey-tasks

Personal tasks, reminders, and calendar, built on the Obsidian vault. The
phone vault folder `Documents/obsidian-vault` is the store. The app is a
standalone Android app. See `docs/adr/` for the decisions and
`tickets/open/` for the work queue.

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
npx vitest run
```

Run the schema tests from `contracts/packages/schemas`:

```bash
npm test
```

## Plan

The app is Expo SDK 58 with React Native 0.88 and expo-router, in
TypeScript (ADR 0001). The vault folder is read and written over Android
SAF with `expo-file-system/legacy` (ADR 0002). No backend (ADR 0003).
Notifications fire on the device with `expo-notifications` (ADR 0004).
Capture parses natural-language dates with chrono-node. Recurrence is
stored as a bare RRULE value and expanded with `rrule`.

There are two tabs: Lists and Planner. The Lists tab shows Focus and
Main. Main is the catch-all: every task that is not on Focus, including
tasks tagged with a list that has no tab (ADR 0015).

Phases:

1. Spike: bare app reads a task note from the vault folder, edits it, and
   the change appears in Obsidian on desktop after sync (0001).
2. Vault vocabulary: lightweight task notes in `Tasks/`, list notes in
   `Tasks/Lists/`, deeds unchanged. Task done is derived from a
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
   the vault. Ticking a recurring task moves its due date forward
   instead of completing it.
7. Later: deed vocabulary cleanup (0005), the quick-task and deed merge
   decision, capture text highlighting (0008), location triggers,
   MCP capture on athena, ntfy fallback, the athena operational dashboard as a possible app surface (idea only), email and calendar
   integrations, pull-only Google Calendar read.
