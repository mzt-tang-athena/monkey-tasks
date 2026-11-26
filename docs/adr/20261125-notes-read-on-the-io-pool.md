# The vault read runs on the IO pool

- **Status:** accepted
- **Date:** 2026-11-25

## Context

Opening the app after a while sat on the loading screen. We measured a
cold start of the release APK on the emulator (ticket
`20261124-faster-cold-start`). The vault read was the largest block. It
ran from the first screen to the first rows, and it took more than half
of that time.

The read was serial, though the code started every note at once.
`expo-file-system/legacy` runs `readAsStringAsync` on Expo's one
`AsyncFunctionQueue` thread. That thread blocks on each SAF read in
turn, and every other Expo call waits behind it. The note parse was
not the cost. It took 2 to 6 ms a note.

## Decision

We read each note with `new File(uri).text()`. The new file API hops
to Android's IO pool, so the provider sees the reads side by side.
The text is the same, so no screen changes.

We weighed four other fixes and kept them out of this change:

- A cache of the last session's rows would show rows at once. It
  changes what the user sees, so it waits for a design review.
- Reading the open tab's folder first would show the tabs late.
- Holding the splash until the first rows helps once rows come fast.
- Reading only the notes that changed needs each note's change time.
  SAF gives that with one provider call per note, as dear as a read.

## Consequences

The read now scales with the provider's CPU, not with a queue. On the
emulator the 190-note vault read took 7.0 s before and 3.6 s after.

The emulator has two cores and draws in software, so a small vault
shows less. The first rows then wait for the first frame's draw.
A phone has more cores. We could not measure it here.

The read is still one provider call per note. A vault with hundreds of
notes still waits on the provider. A cache is the next step.

The read now comes in a pool of 32. A vault of a thousand notes would
otherwise open a thousand reads at once. A cloud provider throttles
that, and Android caps open files near a thousand. The pool keeps the
provider's load steady and the file handles low, and the rows keep
their order. One failed note is still dropped alone.
