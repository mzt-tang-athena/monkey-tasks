---
title: A cold start shows the app sooner
created: 2026-11-24
priority: normal
assignee:
pr:
depends: []
---

## Spec

The operator's feedback on 2026-11-24. Opening the app after a while
shows the default Expo loading screen for a long time. 1.3.0 replaces
that screen with the monkey on the banana tile (#216). This ticket is
about the time.

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
- Hold the splash until the first rows are ready. The rest of the vault
  can load after.

## Acceptance

- [ ] Cold start times before and after, on the same emulator, three
      runs each.
- [ ] The report names what took the time before the fix.
- [ ] The first rows show sooner after the fix, by a stated amount.
- [ ] A vault change made while the app sat closed still shows.

## Outcome

(filled in before moving to done/)
