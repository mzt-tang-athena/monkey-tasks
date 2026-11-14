# monkey-tasks verification map

This directory is the maintained source for verifying what a user of
monkey-tasks sees and does. Read this index, then use the matching
feature file as the recipe. Each recipe drives the web preview through
the journeys that `../SKILL.md` describes. A recipe with a `Driving it
on Android` section also runs on the emulator.

## Baseline preconditions

- `scripts/launch.sh` started the preview on your port, and `scripts/doctor.sh` exits 0 with four `ok` lines.
- Each journey starts on a fresh page, so the memory vault is the sample set from `app/src/lib/vault/sample/`. Nothing carries over between tests.
- The clock starts at `TODAY` from `app/e2e/data.ts`: Monday 26 October 2026, 09:00, Pacific/Auckland, locale en-NZ.
- The viewport is 412 by 915, the size of the owner's phone.

## Driving conventions

- Import `test` and `expect` from `app/e2e/fixtures.ts`, names from `app/e2e/data.ts`, and helpers from `locators.ts`, `gestures.ts` and `vault.ts`.
- Prefer roles and accessible names, then `testID`s. Never click by coordinates when a handle exists.
- Drive gestures with `swipe`, `touchSwipe`, `holdDrag` and `holdDragTo`. They use the hold time and travel the app expects.
- Use `__vault` only to read notes, or to play another app that writes the vault.

## Proof and skip reporting

- Capture a screenshot of the action and of the result, with the target scrolled into view.
- Prove a change to a task by its note text and by the row after `returnToTab`.
- Run both projects, `motion` and `reduced-motion`, for anything that moves.
- Report a check the web cannot make (UI-thread motion, native gestures, keyboard, SAF, notifications) as not verified. Give the reason. Never pass it off as verified through the web.

## Feature entry contract

Each feature file starts with an H1 and one paragraph on what the user
sees. It then has four H2 sections in this order: `Sub-features`,
`How to get to it (user POV)`, `Driving it with Playwright`, and
`Gotchas`. A feature with a native check adds `Driving it on Android`
before `Gotchas`.

## Features

- [Lists](./lists.md) covers the list tabs, the sections, ticks, the sort sheet and reorder. It has an Android recipe for the list swipe with motion on and off.
- [Capture](./capture.md) covers the add sheet, the natural-language parse, the send and a failed write.
- [Planner](./planner.md) covers day, week and month, the split, and drag to schedule.
- [Task editor](./task-editor.md) covers opening a task, editing and saving.
- [Vault sync](./vault-sync.md) covers notes written by another app, repair, and recurring ticks.
