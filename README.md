# monkey-tasks

Personal tasks, reminders, and calendar, built on the Obsidian vault. The
phone vault folder `Documents/obsidian-vault` is the store. The app is a
standalone Android app. See `docs/adr/` for the decisions and
`tickets/open/` for the work queue.

## Plan

React Native and Expo (ADR 0001). The app reads and writes the vault
folder directly (ADR 0002). No backend (ADR 0003). Notifications fire on
the device (ADR 0004).

Phases:

1. Spike: bare app reads a task note from the vault folder, edits it, and
   the change appears in Obsidian on desktop after sync (0001).
2. Vault vocabulary: lightweight task notes in `Tasks/`, list notes in
   `Tasks/Lists/`, deeds unchanged. Task done is derived from a
   `completed` date; reminders are a list; recurrence is an RRULE
   string (0004).
3. Schema package: Zod models for task, deed, and list notes mirroring
   the vocabulary (0002, ADR 0005).
4. MVP screens: focus list, upcoming reminders, calendar, task editor,
   note viewer (0003).
5. Capture: quick capture with offline natural language dates via
   chrono-node and rrule.js. Unparsed lines go to athena agents later
   (0006).
6. Notifications: on-device alarms with recurrence.
7. Later: deed vocabulary cleanup (0005), the quick-task and deed merge
   decision, location triggers, MCP capture on athena, ntfy fallback,
   email and calendar integrations, pull-only Google Calendar read.
