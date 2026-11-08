---
name: verify-monkey-tasks
description: Drive the monkey-tasks app (Expo / React Native tasks app on an Obsidian vault) the way a user does, through its web preview or a release APK on an Android emulator, and keep screenshot, frame, trace and vault-note evidence. Use to prove a change to the Lists, Planner, Capture, task editor or vault sync works, to prove UI-thread motion, native gestures or the SAF vault on Android, to reproduce a UI bug, or to review a PR's visible behavior.
---

# Verify monkey-tasks

The user surface is an Android app. This skill drives two surfaces:

- The web preview, for most checks. It runs the same React tree on
  React Native Web, against a memory vault seeded from
  `app/src/lib/vault/sample/` (ADR 0037). Vault side effects are real
  notes you can read back. The sections from Launch to Helpers cover it.
- An Android emulator running a release APK, for native behavior. The
  Android section covers it.

What the web preview cannot prove: UI-thread motion (Reanimated
worklets run on the JS thread in a browser), native gesture handler
arbitration, keyboard insets, SAF folder access, notifications, and
touch-action behavior on a real touchscreen. Check those on the
emulator. The Android section lists what still needs the phone.

All commands run from the repo root of the checkout under test. Each
checkout uses its own port. Set `VERIFY_PORT` when another instance or
the e2e suite might use the default.

Ports in use by convention: 8094 is the e2e default, and the epic
review agents use 8200 to 8221. This skill defaults to 8300.

## Launch

```sh
.claude/skills/verify-monkey-tasks/scripts/launch.sh          # port 8300
VERIFY_PORT=8310 .claude/skills/verify-monkey-tasks/scripts/launch.sh
```

It runs `npm run web:export` in `app/` (20 to 45 s, longer on a busy
machine; the export sets `EXPO_PUBLIC_VAULT_TEST_HOOKS=1`), stamps `app/dist` with `HEAD`, starts
`app/serve.py` in the background and runs Doctor. Ready means Doctor
prints four `ok` lines. `SKIP_EXPORT=1` reuses the current `dist`.

Setup a fresh checkout needs first: `git -c url."https://github.com/".insteadOf="git@github.com:" submodule update --init`,
`npm ci` at the root and in `app/`, then `npx playwright install chromium` in `app/`.

## Doctor

```sh
.claude/skills/verify-monkey-tasks/scripts/doctor.sh
```

Read-only. It checks that the server pid is alive, that the port is
owned by that pid, that `dist` was built from the current tree, including
edits made after the launch (a `WARN` line means you are testing old
code), and that a
headless page renders sample rows and exposes `globalThis.__vault`.
Run it first whenever anything looks off. Exit code 0 means drivable.

## Drive

Write a journey as a Playwright file named `*.journey.ts`. Reuse the
suite's helpers from `app/e2e/` and never re-derive them:

- `fixtures.ts`. `test` pins the clock to `TODAY` (Mon 26 Oct 2026, 09:00 Auckland). Never freeze the clock before rows show, or the row entrance never finishes. `pauseClock` freezes after.
- `data.ts`. Every sample task name, date and expected label. Take names from here only.
- `locators.ts`. `row(page, name)` (`task-row:<name>`), `sectionHeader`, `listTab`, `expectAbove`, `expectInSection`.
- `gestures.ts`. `swipe`, `touchSwipe`, `holdDrag`, `holdDragTo`.
- `vault.ts`. `noteText`, `putNote`, `notePaths`, `failNextWrite`, `slowVaultAndFailWrite`, `returnToTab`.

Put a throwaway journey in `app/build/verify/journeys/` (gitignored).
Keep a journey worth rerunning in this skill's `journeys/`. Run one
file or a whole directory:

```sh
.claude/skills/verify-monkey-tasks/scripts/drive.sh .claude/skills/verify-monkey-tasks/journeys/capture.journey.ts
.claude/skills/verify-monkey-tasks/scripts/drive.sh app/build/verify/journeys --project=motion
```

Each journey runs twice, as `motion` and `reduced-motion`, at 412 by
915. Extra arguments go to `playwright test`. For a quick look without a
journey, `cd app && npx playwright codegen http://localhost:$VERIFY_PORT` also
works, but it leaves no evidence.

Prefer roles and accessible names (`add task`, `send task`, `open task`,
`mark done`, `save task`, `resize timeline`) and the `testID`s
(`task-row:<name>`, `timeline-hour:<h>`, `day-pager`, `month-pager`,
`reorder-grip:<name>`). Never use coordinates when a handle exists.
The feature map in `features/` has the recipes.

## Evidence

`drive.sh` prints `evidence: app/build/verify/evidence/<stamp>`. Inside
it, `results/<test>/` holds your named screenshots, a final screenshot
and `trace.zip`. `report/index.html` is the HTML report. Open a trace
with `npx playwright show-trace <trace.zip>` from `app/`.

Proof standards:

- Drive the user path: buttons, gestures and typing. Use `__vault` hooks only to read notes, or to act as another app writing the vault (`putNote` then `returnToTab`). Never set app state through them.
- Screenshot the action and the result. Scroll the target into view first (`locator.scrollIntoViewIfNeeded()`), or the shot proves nothing.
- Check the side effect. A write is proved when `noteText` shows the note changed, and the row survives `returnToTab` (a fresh vault read).
- Compare against the base for a regression claim. Launch the base branch in a second worktree on another port and drive the same journey.
- Name what the web cannot prove. See the list at the top.

## Cleanup

```sh
.claude/skills/verify-monkey-tasks/scripts/cleanup.sh   # honors VERIFY_PORT
```

It kills only the pid that `launch.sh` recorded, and only while that
pid is still this port's `serve.py`. It never kills by name. Evidence
under `app/build/verify/evidence/` stays. Delete old runs by hand when
you no longer need them.

## Helpers

All in `scripts/`, all run from anywhere in the checkout.

- `launch.sh` exports, serves and runs Doctor.
- `doctor.sh` is the read-only health check.
- `probe.mjs` is Doctor's headless render check. Doctor runs it.
- `drive.sh <file or dir> [playwright args]` runs journeys and prints the evidence path.
- `cleanup.sh` stops the server.
- `verify.config.ts` extends `app/e2e/playwright.config.ts` with evidence output. `drive.sh` passes it.

## Android

The emulator runs a release APK on the `monkey-tasks-verify` AVD (API
35, x86_64, Pixel 7 at 1080 by 2400). It reads a real vault through the
system folder grant (SAF), and Reanimated runs on the UI thread. One
instance runs per console port. The default is 5580. Set
`ANDROID_VERIFY_PORT` to run a second one. Every Android script sources
`scripts/android-env.sh` for the SDK paths, so no shell setup is needed.

### Get an APK

The `android` workflow builds a release APK from a branch in 19 to 45
minutes. Download it into a new, empty folder:

```sh
gh run list --workflow android --branch epic/0047-rebuild --limit 3
gh run download <run id> --name monkey-tasks-apk -D <new empty dir>
```

A release APK cannot load code from Metro, so it tests what was pushed.
To test local edits without a build, install the dev client once
(`gh workflow run android -f dev=true`, artifact `monkey-tasks-dev-apk`),
then run `adb reverse tcp:8081 tcp:8081` and `npx expo start --dev-client`
in `app/`. The dev client opens the bundle from the host. That path is
not proven yet, and it bundles the dev build, which has the vault test
hooks and slower JavaScript.

### Launch

```sh
.claude/skills/verify-monkey-tasks/scripts/android-launch.sh <apk>   # install this APK
.claude/skills/verify-monkey-tasks/scripts/android-launch.sh         # keep the installed APK
```

It runs the host checks, creates the AVD when it is missing, and boots
it cold (`-no-snapshot`, 2 cores, 2 GB). It then sets the zone to
Pacific/Auckland and hides ANR dialogs. It installs the APK when its
hash changed, and clears the app data. It writes the sample vault for
the device's today with `android-seed.ts` and pushes it to
`/sdcard/Documents/obsidian-vault`. Last, it taps `connect vault folder`
and walks the system picker by its header (`Files in Documents`, then
`Files in obsidian-vault`) to `USE THIS FOLDER` and `ALLOW`. Ready means
it printed `ready: a task row shows`. It saves `launch.png` and
`launch.xml` in a new run folder and prints that folder.

On this host (4 cores) a cold launch took 231 s. Boot took 99 s, the
install 19 s and the picker 76 s. A rerun on a running emulator skips
the boot and an unchanged APK. Each launch reseeds the vault and grants
it again, so every run starts from the same notes. `MOTION=off` starts
with the three animation scales at 0.

### Doctor

```sh
.claude/skills/verify-monkey-tasks/scripts/android-doctor.sh          # host, then instance
.claude/skills/verify-monkey-tasks/scripts/android-doctor.sh --host   # host only
```

Read-only. It checks the SDK, the system image, KVM, the headless qemu
libraries and free memory. Then it checks that the emulator pid is
ours, booted and the right AVD, that the package is installed, that the
vault holds notes, that the app is in front, and that a task row shows.
It prints the animation scales and the run folder. Exit code 0 means
drivable. Each `FAIL` line names the fix.

### Drive

`scripts/android-drive.sh` does one step per call. Run it with no
arguments to see every step. The common ones:

```sh
D=.claude/skills/verify-monkey-tasks/scripts/android-drive.sh
$D tap "add task"                                # tap by label, testID or text
$D tap "task-row:Call Mum>>mark done"            # a node inside another node
$D wait "Nothing on this list yet." 10           # wait for a node
$D scroll-to "task-row:Fix bike light" [up]      # scroll until it is clear of the bars
$D swipe "~TODAY" -600 0 300                     # swipe from a node's center
$D hold-drag "task-row:Call Mum" 0 -300 600      # press, hold, then move in steps
$D type "Buy milk tomorrow"; $D key ENTER
$D motion off                                    # animation scales to 0, restart the app
$D list                                          # every labelled node on screen
```

A handle matches `content-desc` (the accessibility label), then
`resource-id` (the `testID`), then text. It is exact, or a substring
with a leading `~`. `outer>>inner` finds inner within outer's bounds.
Use it for `mark done` and `open task`, which every row has. `@x,y` is
a known point. Read it with `bounds` first when a recording must start
on the gesture. Handles in this app: the tab names, `add task`,
`send task`, `open task`, `mark done`, `mark not done`, `save task`,
`sort list`, `list menu`, `connect vault folder`, and the testIDs
`task-row:<name>`, `list-pager`, `repair-notice`, `reorder-grip:<name>`.

Proven on the emulator so far: `tap`, `wait`, `scroll-to`, `swipe`,
`frames`, `record`, `note` and `log`. `hold-drag`, `drag` and `type` are
written but not yet run on an APK. Check them before you rely on them.

Make a journey safe to run again: `journeys/android-list-swipe.sh` is
the model, since it undoes its own change. The feature map says which
recipes run on Android.

### Evidence

Every step that saves something writes to the run folder that launch
made, under `app/build/verify/evidence/android-<stamp>/`.
`$D new-run` starts another. `$D run` prints the current one.

- `$D shot <name>` saves a screenshot.
- `$D frames <name> <secs> <step...>` records every frame while one step runs and for secs after. It writes `NN.png` and `sheet.png`, a grid in order, to `<name>-frames/`. Read the grid to see motion. There is no ffmpeg on the host, so this is how an agent watches a gesture.
- `$D record <name> <secs> <step...>` saves an mp4 for a human.
- `$D dump <name>` saves the screen tree as `.xml` and a readable `.txt`.
- `$D note "Tasks/<name>.md" <tag>` prints a note from the device and keeps it as `note-<tag>.md`.
- `$D log [name]` saves the React Native and crash log, and the app process log.

Proof standards: drive the user path, capture the action and the
result, and read the note back for every write. For motion, compare a
`frames` grid with motion on against one with `motion off`. Leave the
app with motion on.

### Cleanup

```sh
.claude/skills/verify-monkey-tasks/scripts/android-cleanup.sh               # stop our emulator
.claude/skills/verify-monkey-tasks/scripts/android-cleanup.sh --delete-avd  # and delete the AVD
```

It stops only the emulator pid that launch recorded, and only while
that pid runs our AVD on our port. It never kills by name. It removes
the state file and the seed folder. The evidence and the AVD stay.
Doctor exits nonzero after cleanup.

### What the emulator proves, and what needs the phone

The emulator proves: UI-thread motion, frame by frame (the frames carry
no timestamps), native gesture arbitration under `adb input` touches,
the release JavaScript bundle, the SAF grant and real file writes, app
restart, and that the app runs on API 35. The emulator also has a soft
keyboard, but no run has driven the capture sheet with it yet.

It does not prove: feel and frame rate on real hardware (the emulator
renders in software, on a shared host), multi-touch and finger size,
haptics, notifications and their timing, the owner's keyboard app and
its insets, the owner's file provider and Obsidian sync, and battery or
doze behavior. Leave those to the phone pass, and say so in the report.

### Android gotchas

- Run one driver per emulator. Two `uiautomator dump` calls at once crash the second one.
- A cold boot on a busy host makes System UI miss ANR deadlines. Launch hides the dialogs. The log still records each ANR.
- Heavy screen capture can spoil a gesture. A `screencap` loop during a swipe left the page unturned. `frames` uses `screenrecord`, and the same swipe turned the page.
- A swipe that ends off screen reads as a system gesture. Drive clamps the end to the screen.
- After `force-stop` the old window lingers in the screen tree for a moment. `$D restart` waits for it to go.
- On this APK a shorter write keeps the old tail of the note (ticket 0076). Compare notes byte for byte after an edit that removes text.

### Android helpers

- `android-env.sh` holds the names, paths and state for one port. The other scripts source it.
- `android-launch.sh [apk]` boots, installs, seeds, grants and waits.
- `android-doctor.sh [--host]` is the read-only check.
- `android-drive.sh <step>` drives and saves evidence.
- `android-cleanup.sh [--delete-avd]` stops our emulator.
- `android-seed.ts <out dir> <YYYY-MM-DD> [seeds]` writes the sample vault for a day. Run it from `app/` with `npx tsx`.
- `android-ui.mjs <dump.xml> find|text|list [handle]` reads a screen tree.
- `android-frames.mjs <frames.raw> <out dir> [columns]` turns raw `screenrecord` frames into PNGs and a grid.
