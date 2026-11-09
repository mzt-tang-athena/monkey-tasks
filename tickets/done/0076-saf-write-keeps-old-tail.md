---
id: 0076
title: A shorter note write keeps the old tail on Android
created: 2026-11-08
priority: high
assignee: claude
pr: 96
depends: []
---

## Spec

This is the hotfix for the app on the owner's phone. The epic tracks
the same bug under the same number.

Untick a task on Android and its note keeps the end of the longer
text it had before. A tick adds `completed: <date>` and an untick
removes it. The untick writes fewer bytes, and the file keeps the last
bytes of the ticked text:

```
due: 2026-11-08
---
leted: 2026-11-08
---
```

The app then reads that tail as the note body. Any edit that shortens
a note corrupts it this way.

The cause is in `expo-file-system` 58. For a SAF uri, the legacy
`writeAsStringAsync` calls `contentResolver.openOutputStream(uri, "w")`
(`legacy/FileSystemLegacyModule.kt`, `getOutputStream`). On Android 10
and later, the external storage provider opens "w" without truncating.
Mode "wt" truncates.

`writeNote` in `app/src/features/vault/notes.ts` is the only SAF write.
Make it truncate.

## Acceptance

- [x] A test fails when a shorter write keeps the old tail.
- [x] On the emulator, an APK from `main` shows the tail after an untick.
- [x] On the emulator, an APK from this branch writes the same note clean.

## Outcome

Pull request [#96](https://github.com/mzt-tang-athena/monkey-tasks/pull/96) carries the hotfix.
`writeNote` now opens a `File` handle with `FileMode.Truncate`, which
asks the provider for mode "wt". The epic's ADR 0045 records why this
beats a native patch or delete and create.

On the emulator, an APK from 2d7178b left `leted: 2026-11-08` and a
second `---` after an untick. An APK from this branch wrote the note
back byte for byte.
