# 0002. The app reads and writes the vault folder directly

- **Status:** accepted
- **Date:** 2026-10-17

## Context

The phone vault lives in a plain folder, `Documents/obsidian-vault`, so
any Android app can reach it with the folder-picker permission. The
alternative was a second LiveSync client: the app speaks CouchDB
replication and keeps its own offline cache.

## Decision

The app reads and writes the vault markdown files directly. Obsidian and
LiveSync stay the sync path to the desktop and to athena.

## Consequences

No sync protocol work, and the app needs no server at all. Edits reach
other devices only when Obsidian next syncs, so propagation waits if
Obsidian stays closed. If that delay ever hurts, the app can gain its own
CouchDB replication without a rewrite, because the note format does not
change.
