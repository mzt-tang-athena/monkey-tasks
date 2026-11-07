---
name: verify-monkey-tasks
description: Drive the monkey-tasks app (Expo / React Native tasks app on an Obsidian vault) through its web preview the way a user does, and keep screenshot, trace and vault-note evidence. Use to prove a change to the Lists, Planner, Capture, task editor or vault sync works, to reproduce a UI bug, or to review a PR's visible behavior. Covers the web surface only. Native-only behavior (Reanimated worklets, haptics, SAF, notifications) needs the owner's phone pass.
---

# Verify monkey-tasks

The user surface is an Android app. Agents cannot run Android on this
machine: there is no SDK, no `adb`, and the user is not in the `kvm`
group. The web preview is the drivable surface. It runs the same React
tree on React Native Web, against a memory vault seeded from
`app/src/lib/vault/sample/` (ADR 0037). It runs the same write path as
the phone, so vault side effects are real notes you can read back.

What the web preview cannot prove: UI-thread motion (Reanimated
worklets run on the JS thread in a browser), native gesture handler
arbitration, keyboard insets, SAF folder access, notifications, and
touch-action behavior on a real touchscreen. Say so in the report when
a change touches these, and leave that check to the phone pass.

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

It runs `npm run web:export` in `app/` (about 45 s; the export sets
`EXPO_PUBLIC_VAULT_TEST_HOOKS=1`), stamps `app/dist` with `HEAD`, starts
`app/serve.py` in the background and runs Doctor. Ready means Doctor
prints four `ok` lines. `SKIP_EXPORT=1` reuses the current `dist`.

Setup a fresh checkout needs first: `git -c url."https://github.com/".insteadOf="git@github.com:" submodule update --init`,
`npm ci` at the root and in `app/`, then `npx playwright install chromium` in `app/`.

## Doctor

```sh
.claude/skills/verify-monkey-tasks/scripts/doctor.sh
```

Read-only. It checks that the server pid is alive, that the port is
owned by that pid, that `dist` was built from `HEAD` with no uncommitted
app changes (a `WARN` line means you are testing old code), and that a
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
journey, `cd app && npx playwright codegen http://localhost:8300` also
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

It kills only the pid that `launch.sh` recorded, never by name. Evidence
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
