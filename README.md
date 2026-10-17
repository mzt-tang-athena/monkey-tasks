# tasks-app

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
   the change appears in Obsidian on desktop after sync.
2. Schema package: Zod models for task, reminder, and event notes
   (ADR 0005).
3. MVP screens: focus list, upcoming reminders, calendar, task editor,
   note viewer.
4. Notifications: on-device alarms with recurrence.
5. Later: location triggers, MCP capture on athena, ntfy fallback, email
   and calendar integrations.
