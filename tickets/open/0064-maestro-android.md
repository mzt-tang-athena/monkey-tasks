---
id: 0064
title: Maestro flows on Android
created: 2026-10-26
priority: low
assignee:
pr:
depends: [0049, 0051]
---

## Spec

Playwright (0049) drives the web preview. The phone runs code the
browser never reaches:

- swipes through the responder system (`nativeHandlers` in
  `src/lib/swipe.ts`), and after 0059 through RNGH 3 on the UI thread
- drag sources through RNGH (`NativeGrip` in
  `src/features/lists/ReorderRow.tsx`, `NativeDragHandle` in
  `src/features/planner/components/drag.tsx`)
- the vault read and write through the Storage Access Framework (SAF)
- reminders through `expo-notifications`

Component tests see `Platform.OS` as `web` (ADR 0038), so they skip
these branches too. This ticket adds the missing layer: Maestro flows
that drive a release APK on an Android emulator. ADR 0038 names this
ticket as the Android layer.

We pick Maestro because it drives a release APK with no native test
setup. Only the SAF contract flow below needs a build of its own.
Flows are YAML, and a React Native `testID` is the Maestro `id`. Detox needs a separate test build and native project
changes for each SDK bump.

### The SAF adapter on the device

In Vitest the 0051 contract suite runs the SAF adapter against a fake
`expo-file-system`. The real Storage Access Framework provider needs
Android. A test screen runs the same suite against the SAF adapter, in
a scratch folder under the granted root, and shows a pass or fail line
per case. A Maestro flow opens the screen and checks that every case
passes. Joplin also runs its file system driver tests on the phone, at
startup behind a config flag
([runOnDeviceTests.ts](https://github.com/laurent22/joplin/blob/5321786784c526093ec3aff10e9f87a7ee515c4d/packages/app-mobile/utils/fs-driver/runOnDeviceTests.ts)).

The screen shows only when `EXPO_PUBLIC_VAULT_TEST_HOOKS` is `1`, the
flag that 0051 uses. The APK that reaches a phone never sets it (ADR
0037 and its 2026-10-27 amendment). So this one flow needs its own
build:

- The workflow input `saf-contract` (default `false`) turns the flow
  on.
- With it on, the job builds an x86_64 release APK with
  `EXPO_PUBLIC_VAULT_TEST_HOOKS=1 ./gradlew assembleRelease -PreactNativeArchitectures=x86_64`.
- That APK never leaves the job. The workflow uploads no artifact of
  it, and `android.yml` never sets the flag.
- With it on, the job installs only the flagged APK and runs every
  flow on it, this flow last.
- With it off, the flows run on the reused release APK and skip this
  flow.
- The flow carries the Maestro tag `saf-contract`, and
  `app/e2e/maestro/config.yaml` excludes that tag. So
  `maestro test app/e2e/maestro` skips it on a laptop too. The job
  with the input on runs it by its file name.
- The build makes the job longer. Set `timeout-minutes` from the
  input, for example `${{ inputs.saf-contract && 75 || 30 }}`.

Record the build minutes of the flagged APK in Outcome.

### APK

The emulator on a GitHub runner is x86_64.

- `.github/workflows/android.yml` builds the release APK with
  `assembleRelease` and no ABI filter. That APK carries x86_64 and
  installs on the emulator.
- The dev client build passes `-PreactNativeArchitectures=arm64-v8a`.
  It does not install on the emulator.

The new workflow downloads the APK artifact of the latest green
`android.yml` run with `actions/download-artifact@v4` (`run-id` and
`github-token`). That skips the build, which took 19 to 45 minutes on
the last eight runs. With no artifact at hand, it builds with
`./gradlew assembleRelease -PreactNativeArchitectures=x86_64`.

### Data and clock

The flows use the fixture notes from 0051, the same set the web
preview and Playwright use. Playwright pins the clock to `TODAY` in
`app/e2e/fixtures.ts`. The emulator gets the same day:

1. Use a `google_apis` image, which allows `adb root`.
2. `adb shell settings put global auto_time 0`, then set the date and
   time to `TODAY` with `adb shell date`.
3. `adb shell setprop persist.sys.timezone Pacific/Auckland`.
4. `adb push` the fixture folder to `/sdcard/Documents/MonkeyVault`.

If the image refuses the date, a seed script writes the notes with
dates relative to the device day instead. Record which path works in
Outcome.

### Flows

Put them in `app/e2e/maestro/`. One subflow, `grant.yaml`, taps
"connect vault folder", opens `Documents/MonkeyVault` in the system
picker, and taps "Use this folder" and "Allow". The picker is system
UI, and its labels change between Android versions. Pin one API level
(34) and the English locale.

Cover the ten scenarios of 0049. Two of them check the write path,
which the web preview cannot:

- tick: after the flow, `adb shell cat` the "Call Mum" note and find a
  `completed:` line.
- capture: after the flow, `adb shell ls` the Tasks folder and find the
  new note.

For reduced motion, set `animator_duration_scale`,
`transition_animation_scale` and `window_animation_scale` to 0 with
`adb shell settings put global` before the flow.

Gestures:

- Swipes: Maestro `swipe` with `start`, `end` and `duration`.
- Reorder: start on the grip. Its pan picks the row up at once.
- Drag to schedule: the drag source waits for a 300 ms hold
  (`activateAfterLongPress` in `drag.tsx`). Maestro has no hold-then-drag
  step. Use `adb shell input draganddrop x1 y1 x2 y2 1500` from a
  workflow step. It holds for the long-press timeout, then moves. Read
  the points from `maestro hierarchy`.

### Workflow

Add `.github/workflows/android-e2e.yml` with `workflow_dispatch` only:

```yaml
jobs:
  maestro:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - name: Enable KVM
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm
      # download the APK artifact, cache the AVD, install Maestro at a pinned version
      - uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 34
          target: google_apis
          arch: x86_64
          script: ./app/e2e/maestro/run.sh
```

`run.sh` installs the APK, pins the clock, pushes the fixtures, and
runs `maestro test app/e2e/maestro`.

### Cost

| Step | Estimate |
|---|---|
| Download the APK artifact | about 1 minute |
| Build an x86_64 APK instead | not measured. The four-ABI build took 19 to 45 minutes |
| KVM and emulator boot, AVD cache hit | 2 to 4 minutes |
| Seed, grant, ten flows | 3 to 5 minutes |
| Run with the artifact | about 8 to 12 minutes |

GitHub Free gives a private repo 2,000 Linux minutes a month. A nightly
run with the artifact costs about 300 of them. A nightly run with a
build costs 900 to 1,500. So the workflow starts on `workflow_dispatch`
only. We run it before the epic's final PR to main, beside the phone
pass. A schedule waits until Outcome shows its monthly cost fits.

Run the same flows on a laptop with `maestro test app/e2e/maestro`
against a local emulator or a phone over USB. That costs no CI minutes.

## Acceptance

- [ ] `maestro test app/e2e/maestro` passes on a local x86_64 emulator with the fixture vault.
- [ ] `android-e2e.yml` starts on `workflow_dispatch` only and passes.
- [ ] The workflow installs the APK from the latest green `android.yml` run when one exists.
- [ ] The emulator day and zone match `TODAY` in `app/e2e/fixtures.ts`, or Outcome records the fallback.
- [ ] After the grant, the app lists the fixture notes from 0051.
- [ ] The grant subflow passes the system folder picker on API 34.
- [ ] Flows cover the ten scenarios of 0049, or Outcome names each gap and its reason.
- [ ] After the tick flow, the "Call Mum" note on the device holds a `completed:` line.
- [ ] After the capture flow, the device Tasks folder holds the new note.
- [ ] With `saf-contract` on, a flow runs the 0051 contract suite against the SAF adapter on the emulator, and every case passes.
- [ ] No uploaded artifact and no `android.yml` build sets `EXPO_PUBLIC_VAULT_TEST_HOOKS`.
- [ ] The reduced motion flow runs with all three animation scales at 0 and passes.
- [ ] A React Native `testID` from 0049 selects its view as a Maestro `id`.
- [ ] Outcome records the measured time of each step and the monthly minutes of the chosen trigger.

## Outcome
(filled in before moving to done/)
