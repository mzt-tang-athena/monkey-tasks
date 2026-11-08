---
id: 0076
title: A shorter note write keeps the old tail on Android
created: 2026-11-08
priority: high
assignee:
pr:
depends: []
---

## Spec

The emulator run for ticket 0073 found this. Untick a task on Android
and its note keeps the end of the longer text it had before. A tick
adds `completed: <date>` and an untick removes it. The untick writes
fewer bytes, and the file keeps the last bytes of the ticked text:

```
due: 2026-11-08
---
leted: 2026-11-08
---
```

The app then reads that tail as the note body, and writes it back on
every later edit. Any edit that shortens a note corrupts it this way.

The cause is in `expo-file-system` 58, the legacy API. For a SAF uri,
`writeAsStringAsync` calls `contentResolver.openOutputStream(uri, "w")`
(`FileSystemLegacyModule.kt`, `getOutputStream`). On Android 10 and
later, the external storage provider opens "w" without truncating. Mode
"wt" truncates. The web preview and the tests use the memory adapter,
so they never see it.

Fix the write in `app/src/lib/vault/adapters/saf.ts`. Options: write
through an API that truncates (the new `expo-file-system` `File` API, or
a patch that opens "wt"), or write to a new file and swap it in. Pick
one in an ADR, since each has a trade-off.

## Acceptance

- [ ] `journeys/android-list-swipe.sh` in the verification skill passes on the emulator: the note after the untick matches the note before the tick, byte for byte.
- [ ] A test pins the truncating write for the SAF adapter.
- [ ] The owner's phone shows the same round trip.

## Outcome
(filled in before moving to done/)
