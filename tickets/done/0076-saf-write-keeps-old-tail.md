---
id: 0076
title: A shorter note write keeps the old tail on Android
created: 2026-11-08
priority: high
assignee: claude
pr: 95
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

Fix the write in `app/src/lib/vault/adapters/saf.ts`. One option
writes through an API that truncates (the new `expo-file-system` `File`
API, or a patch that opens "wt"). Another writes to a new file and swaps
it in. Pick
one in an ADR, since each has a trade-off.

## Acceptance

- [x] `journeys/android-list-swipe.sh` in the verification skill passes on the emulator. The note after the untick matches the note before the tick, byte for byte.
- [x] A test pins the truncating write for the SAF adapter.
- [ ] The owner's phone shows the same round trip.

## Outcome

Pull request [#95](https://github.com/mzt-tang-athena/monkey-tasks/pull/95) carries the fix.
The SAF adapter now writes through `File.open(FileMode.Truncate)`,
which opens the document with mode "wt". ADR 0045 records why.

The fake provider keeps the old tail on mode "w", as the phone does. A
contract case, "leaves no old tail when a write is shorter", failed on
the old adapter and passes now.

On the emulator, the journey failed on an APK from 4828d9c with the
`leted:` tail. It passed on an APK from this branch. The phone check
waits for the owner.

### The same bug on main, 2026-11-09

The bug reached `main` before this branch merged. Pull request
[#96](https://github.com/mzt-tang-athena/monkey-tasks/pull/96) fixed it
there in `writeNote` in `app/src/features/vault/notes.ts`, with the
same `File.open(FileMode.Truncate)` write. An APK from `2d7178b` left
the tail; an APK from that branch wrote the note back byte for byte.

The epic then moved the vault code into `app/src/lib/vault`. As a
result, this branch no longer has the main file, and the adapter owns
the write. Only one fix remains in the code, in the adapter. Both
emulator runs appear above.
