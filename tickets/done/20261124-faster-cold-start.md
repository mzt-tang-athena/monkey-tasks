---
title: A cold start shows the app sooner
created: 2026-11-24
priority: normal
assignee: cold-start-lane
pr: 240
depends: []
---

## Spec

The operator's feedback on 2026-11-24. Opening the app after a while
shows the default Expo loading screen for a long time. 1.3.0 replaces
that screen with the monkey on the banana tile (#216), once it ships.
This ticket is about the time.

- Measure a cold start on the release APK first. Time from tap to the
  first frame, to the first rows, and to an idle main thread. Use
  `adb shell am start -W` and a trace. Take a Hermes profile of the JS
  start.
- Explain the number: name what blocks the first rows. Suspects are
  the JS bundle load, fonts and the vault read through SAF. Parsing
  every note before the first render is another.
- Fix the largest cost. One option shows the last session's rows from
  a cache while the vault reads. Another reads the open tab's folder
  first. A third moves work off the first frame. Weigh each in the PR.
- Weigh when the splash should lift. Holding it until the first rows
  are ready avoids an empty frame. It only helps once those rows come
  fast.

## Acceptance

- [x] Cold start times before and after, on the same emulator, three
      runs each.
- [x] The report names what took the time before the fix.
- [x] The first rows show sooner after the fix, by a stated amount.
- [x] A vault change made while the app sat closed still shows.

## Outcome

The vault read took more than half of a cold start. Its notes read
in turn, because Expo runs every async file call on one queue
(ADR `20261125-notes-read-on-the-io-pool`). Notes now read through the
new file API, on the IO pool. Nothing a user sees changed.

Measured on the release APK, on the emulator, medians of five runs
with 40 notes, interleaved before and after:

- Vault read: 2.6 s to 0.7 s.
- JS start to first rows: 3.0 s to 2.1 s.
- Tap to first rows: 4.9 s to 4.3 s.
- That last one sits near the noise. Host load moves it 0.4 s.
- With 190 notes, three runs: tap to rows 9.1 s to 6.0 s.

The rest of the wait is the native start before the JS runs (1.8 s,
38%). With few notes the draw of the first frame also counts.

The cached first frame shipped too (ADR `20261126-a-cached-first-frame`).
The launch tab's rows sit in app storage and draw at once, dimmed and
untappable. The read replaces them in full. With 190 notes, rows showed
3.3 s after the tap against 4.3 s without the cache. That is three
interleaved pairs. Nothing needed a new vault property.
