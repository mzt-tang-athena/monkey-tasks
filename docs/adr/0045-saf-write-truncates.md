# 0045. A SAF write opens the document with mode "wt"

- **Status:** accepted
- **Date:** 2026-11-08

## Context

The SAF adapter wrote notes with the legacy `writeAsStringAsync` from
`expo-file-system` 58. For a SAF uri it calls
`contentResolver.openOutputStream(uri, "w")`. On Android 10 and later
the external storage provider opens "w" without truncating. A shorter
write keeps the old bytes past its end. An untick left
`leted: 2026-11-08` and a second `---` at the end of the note, and the
app read that tail as the body (ticket 0076).

The new `File.write()` has the same fault. `SAFDocumentFile` opens its
output stream with "w" too. Only `File.open(FileMode.Truncate)` asks the
provider for "wt".

## Decision

We write a SAF document through `new File(uri).open(FileMode.Truncate)`,
then `writeBytes` and `close`. The uri stays the same, so the
compare-and-swap write and the rename keep working.

We rejected three other ways. A patch to the native module opens "wt"
too, but we would carry it through every SDK upgrade. Write then
truncate has no truncate call in the legacy API. Delete and create gives
the note a new uri, and a create can get a " (1)" name.

## Consequences

The fix uses a public SDK call and no native change. Tests cannot see
native truncation, so the fake provider now keeps the old tail on mode
"w", as the phone does. A contract case fails if the SAF adapter goes
back to "w".

The write is still not atomic. A crash between the truncate and the
write leaves a short note. The old "w" write had the same gap.
