---
id: 0049
title: Playwright E2E on web
created: 2026-10-26
priority: high
assignee: claude-code
pr: 72
depends: [0048]
---

## Spec

Phase 0 of the rebuild (0047). The app has no end-to-end test. Phases 2
to 4 rewrite the data layer, the screens and every gesture. We want a
suite that drives the real app through those rewrites and catches a
regression the day it lands. ADR 0038 records the decision.

The browser preview serves the in-memory sample set from
`src/lib/mock.ts` when no vault folder is granted
(`src/store/tasks.tsx:275-284`). Playwright drives that preview. 0051
later replaces the mock with the memory adapter, seeded from `.md`
fixture notes. The suite must pass on both sides of that change.

### What the probe proved

A probe on 2026-10-26 drove `npx expo start --web` with Playwright 1.63
and Chromium, at a 412x915 viewport. A local permission rule blocked the
output folder, so the probe never ran the exported build. The first step
of this ticket checks the suite against the export.

| Scenario | Method | Result |
|---|---|---|
| First row visible | `goto`, wait for "Call Mum" | 1.5 s after load, 1.1 s on a warm reload |
| Tick | click "mark done" in the row | label flips to "mark not done" in 197 ms |
| List tab swipe | `page.mouse`, 15 steps, from a section header | Main to Errands and back. A 50 px swipe springs back |
| Planner day swipe | `page.mouse` on the timeline | Monday 26 to Tuesday 27 |
| Month swipe | `page.mouse` on the grid | October 2026 to November 2026 |
| Reorder in My order | hold 400 ms, then 12 steps | "Call Mum" moves above "Book train tickets home", 4 of 4 runs |
| Drag to schedule | hold 450 ms, drop on "10 AM" | "Return library books" shows 10:00 AM |
| Capture | type "Buy stamps for card friday 5pm", send | chip "Fri 30 5:00 PM", row under "Fri, 30 Oct" |
| Editor save | rename "Call Mum", save | the list shows the new name, URL is `/` |
| Reduced motion | context `reducedMotion: "reduce"` | the tab changes at mouse up. With motion it changes after the slide |

Each scenario took 0.8 to 4.3 s.

Two rules came out of the probe:

- `page.clock.install({ time })` pins the sample dates and lets time
  run. `page.clock.setFixedTime()` freezes `Date.now`, so the row
  entrance never ends and no row becomes visible. Use `install` only.
- `page.mouse` takes viewport points. Call `scrollIntoViewIfNeeded()`
  before a gesture on a row below the fold. Without it, the press lands
  off screen and the gesture does nothing.

### Bugs the probe found

**B1. A mouse swipe that starts on a task row opens the task editor.**
Repro: open the preview at 412x915 on the Main list. Press on the
"Supplements" row at x=360, move to x=60 on the same row in 15 steps,
release. Expected: the next list. Actual: the URL turns into
`/task/mock%3A%2F%2Fvault%2FTasks%2FSupplements.md` and the editor
opens. Press and release land on the same row, so the browser fires a
`click` on it. The list pager (`src/app/(tabs)/index.tsx:820-824`,
`src/lib/swipe.ts:139-164`) never swallows that click. The planner does
(`src/features/planner/hooks/usePlannerGestures.ts:193-210`). 0059
fixes it. This ticket adds the test with `test.fail()`.

**B2. A touch swipe never turns the list page in a mobile browser.**
Repro: a context with `hasTouch` and `isMobile`. Send CDP
`Input.dispatchTouchEvent`: `touchStart` at x=360 on a section header,
15 `touchMove` steps of -20 px, then `touchEnd`. The page logs
`pointerdown`, one `pointermove`, then `pointercancel`. The tab stays on
Main. The swipe body keeps `touch-action: auto`, so Chrome claims the
pan. The Android build reads the responder system and does not show
this. 0059 fixes it. This ticket adds the test with `test.fail()`.
Confirm on a phone browser when 0059 lands.

**B3. Selected and checked states do not reach the web.**
React Native Web 0.21.4 maps `aria-*` props and drops the
`accessibilityState` object. On web, no list tab reports which list is
open, and no tick reports whether it is done. Seven sites use the
dropped prop:

- `src/app/(tabs)/index.tsx:868` (list tabs) and `:1002` (sort options)
- `src/features/planner/components/PlannerHeader.tsx` (mode tabs)
- `src/features/planner/components/FormToggle.tsx` (form toggle)
- `src/components/BottomBar.tsx:331` (bottom tabs)
- `src/components/TaskRow.tsx:182` (tick)
- `src/components/ui/Button.tsx` (disabled, busy)

Swap each for `aria-selected`, `aria-checked`, `aria-disabled` and
`aria-busy`. React Native 0.88 reads the same props on Android. This
ticket fixes it, because the suite asserts on these states.

**B4. The reorder grip has no name.** `ReorderGrip` in
`src/features/lists/ReorderRow.tsx:56-97` renders six dots with no
label, so a screen reader and a test cannot find it. Add
`accessibilityLabel="reorder handle"`. This ticket fixes it.

### Selectors

The app has no `testID` today. Each list shows 11 buttons named "mark
done" and 11 named "open task", so a test cannot pick one row by role.
React Native Web turns `testID` into `data-testid`,
`accessibilityLabel` into `aria-label`, and `accessibilityRole` into
`role`. Add these test ids:

| Target | File | `testID` |
|---|---|---|
| Task row root | `src/components/TaskRow.tsx` | `task-row:<name>` |
| Reorder grip | `src/features/lists/ReorderRow.tsx` | `reorder-grip:<name>` |
| List pager body | `src/app/(tabs)/index.tsx:820` | `list-pager` |
| Day pager body | `src/features/planner/components/DaySpread.tsx` | `day-pager` |
| Day heading | `DaySpread.tsx` | `day-heading` |
| Month pager | `src/features/planner/components/MonthView.tsx:83` | `month-pager` |
| Month title | `MonthView.tsx` | `month-title` |
| Timeline hour slot | `src/features/planner/components/Timeline.tsx:86` | `timeline-hour:<hour>` |

Prefer role and name for everything else: `getByRole("tab", { name:
"Errands" })`, `getByRole("button", { name: "send task" })`,
`getByPlaceholder("Add a task")`, `getByRole("textbox", { name: "Task
name" })`. Scope row buttons through the row:
`page.getByTestId("task-row:Call Mum").getByRole("button", { name:
"mark done" })`.

### Layout

```
app/e2e/
  playwright.config.ts
  fixtures.ts      test with the pinned clock, TODAY
  gestures.ts      swipe, holdDrag, touchSwipe
  data.ts          sample names and the dates they land on under TODAY
  specs/
    tasks.spec.ts      tick, untick, editor save
    capture.spec.ts    capture with a date phrase
    lists.spec.ts      tab swipe, reorder, B1, B2
    planner.spec.ts    day swipe, month view, drag to schedule
    motion.spec.ts     reduced motion
```

Specs take task names and dates from `data.ts` only. 0051 then changes
one file if the fixture set changes.

### Config

```ts
// app/e2e/playwright.config.ts
import { defineConfig } from "@playwright/test";

const port = 8094;

export default defineConfig({
  testDir: "./specs",
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
    viewport: { width: 412, height: 915 },
    timezoneId: "Pacific/Auckland",
    locale: "en-NZ",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "motion" },
    { name: "reduced-motion", use: { reducedMotion: "reduce" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `python3 serve.py dist ${port}`,
        cwd: "..",
        url: `http://localhost:${port}`,
        reuseExistingServer: !process.env.CI,
      },
});
```

`app/serve.py` serves `dist/` and falls back to `index.html`, so
`/planner` survives a reload. CI runs in UTC, and the sample dates
follow the local day. The pinned zone and locale keep every run on the
same day. Retries stay at zero: a flaky test is a bug to fix.

Both projects run every spec, so each end state also holds with reduced
motion. `motion.spec.ts` reads the project's `reducedMotion` option and
asserts the matching timing.

```ts
// app/e2e/fixtures.ts
import { test as base } from "@playwright/test";

/** Monday 26 October 2026, 09:00 in Auckland (NZDT). */
export const TODAY = new Date("2026-10-26T09:00:00+13:00");

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.clock.install({ time: TODAY });
    await use(page);
  },
});
export { expect } from "@playwright/test";
```

```ts
// app/e2e/gestures.ts: the probe ran these steps
import type { Locator, Page } from "@playwright/test";

/** A horizontal swipe that starts on `from`. Until 0059, start on a
    section header, not a row (B1). */
export async function swipe(page: Page, from: Locator, dx: number) {
  await from.scrollIntoViewIfNeeded();
  const box = (await from.boundingBox())!;
  const x = dx < 0 ? 360 : 60;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + 2, { steps: 15 });
  await page.mouse.up();
}

/** Press, hold past drag.pickMs (300 ms, src/theme/tokens.ts:151),
    then move. */
export async function holdDrag(
  page: Page,
  from: Locator,
  to: { x: number; y: number },
  holdMs = 400,
) {
  await from.scrollIntoViewIfNeeded();
  const box = (await from.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

/** A touch swipe through CDP. Needs a context with hasTouch. */
export async function touchSwipe(page: Page, from: { x: number; y: number }, dx: number) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, x?: number, y?: number) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x: x!, y: y! }],
    });
  await send("touchStart", from.x, from.y);
  for (let i = 1; i <= 15; i++) {
    await send("touchMove", from.x + (dx * i) / 15, from.y);
    await page.waitForTimeout(16);
  }
  await send("touchEnd");
}
```

### Scenarios

| # | Spec | Steps | Assertion |
|---|---|---|---|
| 1 | tasks | tick "Call Mum" | its tick has `aria-checked="true"` and the row moves to Completed |
| 2 | tasks | tick, then untick "Call Mum" | the row is back under "No date" |
| 3 | capture | "add task", type "Buy stamps for card friday 5pm", check the chip, send | chip reads "Fri 30 5:00 PM", and the row sits under "Fri, 30 Oct" with "5:00 PM" |
| 4 | lists | swipe left from the "Today" header | the "Errands" tab has `aria-selected="true"`. A 50 px swipe keeps "Main" |
| 5 | lists | "sort list", "My order", hold-drag "Call Mum" above "Book train tickets home" | the order flips and holds after a tab round trip |
| 6 | planner | swipe left on `day-pager` | `day-heading` reads "Tuesday 27", and "Dentist appointment 2:30 PM" shows |
| 7 | planner | "Month" tab, swipe left on `month-pager` | `month-title` goes from "October 2026" to "November 2026" |
| 8 | planner | hold-drag "Return library books" onto `timeline-hour:10` | the row shows "10:00 AM" |
| 9 | tasks | open "Call Mum", rename it, "save task" | the list shows the new name, URL is `/` |
| 10 | motion | swipe the list | reduced motion: "Errands" is selected at mouse up. Motion: "Main" stays selected at mouse up and "Errands" wins within 500 ms |

Known bugs, each with `test.fail()` and a comment that names its ticket:

- `lists.spec.ts`: "a swipe that starts on a row does not open the editor" (B1, 0059).
- `lists.spec.ts`: "a touch swipe turns the page", in a `hasTouch` context (B2, 0059).

0059 removes the `test.fail()` marks. A passing `test.fail()` fails the
run, so the suite reports when a fix lands.

### Scripts and CI

`app/package.json`:

```json
"web:export": "expo export --platform web --output-dir dist",
"e2e": "npm run web:export && playwright test -c e2e/playwright.config.ts",
"e2e:dev": "E2E_BASE_URL=http://localhost:8081 playwright test -c e2e/playwright.config.ts"
```

Add `@playwright/test` as a dev dependency at an exact version.
`e2e:dev` runs against a running `npx expo start --web`.

New job in `.github/workflows/ci.yml`. It reuses the checkout,
submodule and install steps of the `code` job:

```yaml
  e2e-web:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      # checkout, contracts submodule, setup-node, npm ci (as in `code`)
      - uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('app/package-lock.json') }}
      - name: Install Chromium
        run: npx playwright install --with-deps chromium
        working-directory: app
      - name: Export the web build
        run: npx expo export --platform web --output-dir dist
        working-directory: app
      - name: Run Playwright
        run: npx playwright test -c e2e/playwright.config.ts
        working-directory: app
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: app/e2e/playwright-report
          retention-days: 7
```

Budget: about 3 minutes. The Android Metro export took 38 s in the last
green CI run. The web export should take about the same.

Also:

- ESLint covers the new folder: `npx eslint src scripts e2e --max-warnings 0`
  in `ci.yml` and `^app/(src|e2e)/` in `.githooks/pre-commit`.
- Add `e2e/playwright-report/` and `e2e/test-results/` to `app/.gitignore`.

## Acceptance

- [x] `npm run e2e` exports the web build, serves it, and passes both projects.
- [x] `npm run e2e:dev` passes against `npx expo start --web`.
- [x] Scenarios 1 to 10 pass in the `motion` and `reduced-motion` projects.
- [x] A test reproduces B1, and it carries `test.fail()` and a comment that names 0059.
- [x] A test reproduces B2 in a `hasTouch` context, and it carries `test.fail()` and a comment that names 0059.
- [x] A test reproduces B3 first: it fails on `aria-selected` before the prop swap and passes after it.
- [x] No component passes `accessibilityState`, and `grep -rn accessibilityState app/src` finds no match.
- [x] A test reproduces B4 first: `getByRole("button", { name: "reorder handle" })` fails before the label and passes after it.
- [x] Each target in the selector table carries its `testID`, and the specs use no pixel coordinate except inside `gestures.ts`.
- [x] Specs take task names and dates from `e2e/data.ts` only.
- [x] The suite pins the clock with `page.clock.install`, and no file calls `setFixedTime`.
- [x] Ten runs in a row with `--repeat-each=10` pass with no failure.
- [ ] The `e2e-web` job passes in CI in under 5 minutes, and a second run hits the browser cache.
- [ ] A failing CI run uploads the HTML report with traces.
- [x] Vitest does not collect any file under `app/e2e/`.
- [x] `tsc --noEmit` and ESLint cover `app/e2e/` and pass.

## Outcome

Landed in PR 72:

- `app/e2e` with the config, fixtures, data, gestures and locators from
  the spec, and five specs: 18 tests, run in the `motion` and
  `reduced-motion` projects. Scenarios 1 to 10 pass in both. 360 of 360
  runs passed with `--repeat-each=10`. A `CI=1` run with two workers
  took 39 s. `e2e:dev` passed against `npx expo start --web`, run on
  port 8094 through `E2E_BASE_URL`.
- B1 carries `test.fail()` in the `motion` project only. With reduced
  motion the page turns at pointer up, so the row is gone before the
  click lands and the editor never opens. 0055 guards the click and
  0059 fixes the pager. Both tickets now say that the first to land
  removes the mark. B2 fails in both projects, as found.
- B3: the seven sites send `aria-*` props. The `lists` spec failed on
  `aria-selected` first, and a `TaskRow` component test failed on
  `aria-checked` first.
- B4: the grip is a button named "reorder handle". It failed on its
  role first. It is no tab stop until 0063 adds keyboard actions.
- The test ids from the table. A still copy (the day swipe preview, the
  drag ghost, the month beside the live one) carries none, because
  Playwright fails at once on two matches. ADR 0038 has an amendment.
- Specs name a swipe by direction and length. `gestures.ts` holds every
  pixel value.

Found and fixed on the way, each with a failing test first:

- `serve.py` kept the default listen backlog of 5. Five workers loading
  the app at once got connection resets, and the first test in each
  worker failed. It now takes 128.
- The planner listed "Broken note" as a task row in the week list. It
  now drops notes that fail validation, as the Lists screen does.
- A week column sorted a recurring occurrence by its stored day, so
  7:00 PM sat above 2:30 PM on Tuesday. `sortByTimeOfDay` fixes it.

Left:

- The `e2e-web` CI job and the CI lint over `e2e`. The agent token has
  no `workflow` scope, so GitHub refuses the change. Ticket 0068 holds
  one diff for the owner with the triggers, the lint limit and the
  job, and the two CI acceptance lines moved there. Locally, a failing
  `CI=1` run wrote the HTML report with the trace zip.
- The suite runs the browser preview's sample set. 0051 swaps it for
  the memory adapter. Then only `e2e/data.ts` changes.
