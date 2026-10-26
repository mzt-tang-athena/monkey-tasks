---
id: 0048
title: Test harness and lint baseline
created: 2026-10-26
priority: high
assignee:
pr:
depends: []
---

## Spec

Phase 0 of the rebuild (0047). Every later phase moves files. Before the
first move we want three things: tests that render real components, zero
lint warnings, and CI that runs. ADR 0038 records the test decision.

### What exists

- `app/vitest.config.ts` runs every test in node. Each run prints a Vite
  warning: "ESM syntax in a file loaded as CommonJS
  (vitest.config.ts:1:1)".
- The suite has 30 files and 261 tests. It passes in about 2 s. Four
  runs on 2026-10-26 showed no flaky test.
- Six `.test.tsx` files render with `react-test-renderer` and replace
  `react-native` through `vi.mock("react-native")`:
  - `src/components/TaskRow.test.tsx`
  - `src/features/planner/components/MonthView.test.tsx`
  - `src/features/planner/components/SourceToggle.test.tsx`
  - `src/features/planner/components/TaskListSection.test.tsx`
  - `src/features/task-editor/TaskEditorScreen.test.tsx`
  - `src/store/tasks.test.tsx`
- The first, second and fourth import the stand-ins in
  `src/test/rn-standin.ts`. A stand-in keeps the props and nothing else,
  so a test "taps" by calling `props.onPress()` and finds nodes by type
  name.
- `src/store/tasks.test.tsx` switches `Platform.OS` between `android`
  and `web` (line 286). It tests the provider, not a screen.
- `src/lib/swipe.test.ts` and `src/features/reminders/sync.test.ts` mock
  `react-native` for logic tests. They render nothing.
- `npx eslint src scripts` prints 54 warnings:
  - 33 `import/first` in test files. The imports sit after the
    `vi.mock` calls on purpose.
  - 20 spacing warnings from the ADR 0012 rule: 15 in
    `src/features/planner/components/plannerStyles.ts`, 2 in
    `PeriodStrip.tsx` (lines 30, 39), and one each in
    `PlannerHeader.tsx:18`, `src/components/TaskRow.tsx:281` and
    `src/components/PreviewRow.tsx:94`.
  - 1 `react-hooks/exhaustive-deps` at `PeriodStrip.tsx:138`. Line 114
    copies the imported token `periodStep` into a local `STEP`, so the
    hook sees a component value.
- `vitest run --reporter=json` writes `app/.vitest/json/output.json`.
  Git does not ignore `.vitest/`.
- `.github/workflows/ci.yml:2` runs on `[push, pull_request]`. A commit
  on a PR branch runs CI twice.
- `.github/workflows/android.yml:14-18` builds a release APK on every
  push to main that touches `app/`. The last eight builds took 19 to 45
  minutes each. Since 2026-10-24 every job fails in 2 s with "recent
  account payments have failed or your spending limit needs to be
  increased". The owner fixes billing. This ticket cuts the spend.

### Work

1. Rename `app/vitest.config.ts` to `app/vitest.config.mts` and split
   it into two projects. The include lists keep `app/e2e/` (0049) out of
   vitest.

   ```ts
   import { configDefaults, defineConfig } from "vitest/config";
   import path from "node:path";

   const src = path.resolve(import.meta.dirname, "src");

   export default defineConfig({
     resolve: {
       alias: [
         { find: /^@\//, replacement: `${src}/` },
         {
           find: "expo-file-system/legacy",
           replacement: path.resolve(import.meta.dirname, "vitest.stub.ts"),
         },
       ],
     },
     test: {
       projects: [
         {
           extends: true,
           test: {
             name: "unit",
             environment: "node",
             include: [
               "src/**/*.test.ts",
               "scripts/**/*.test.ts",
               "src/store/**/*.test.tsx",
             ],
           },
         },
         {
           extends: true,
           resolve: {
             alias: [{ find: /^react-native$/, replacement: "react-native-web" }],
           },
           test: {
             name: "component",
             environment: "jsdom",
             include: ["src/**/*.test.tsx"],
             exclude: [...configDefaults.exclude, "src/store/**"],
             setupFiles: ["src/testing/dom-setup.ts"],
           },
         },
       ],
     },
   });
   ```

2. Add `app/src/testing/dom-setup.ts`. jsdom lacks these globals, and
   React Native Web reads them at render time. Testing Library cleans
   up after each test only when `afterEach` is a global, and our config
   keeps globals off.

   ```ts
   import { cleanup } from "@testing-library/react";
   import { afterEach } from "vitest";

   (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

   globalThis.ResizeObserver ??= class {
     observe() {}
     unobserve() {}
     disconnect() {}
   };

   window.matchMedia ??= (query: string) =>
     ({
       matches: false,
       media: query,
       addEventListener() {},
       removeEventListener() {},
     }) as unknown as MediaQueryList;

   afterEach(cleanup);
   ```

3. Add dev dependencies: `jsdom`, `@testing-library/react`,
   `@testing-library/dom`. Keep `react-test-renderer` until 0052
   rewrites `src/store/tasks.test.tsx`.

4. Move the five screen tests to Testing Library: `TaskRow`,
   `MonthView`, `SourceToggle`, `TaskListSection`, `TaskEditorScreen`.
   Each test renders with `render()`, finds nodes by role, label or
   text, and acts with `fireEvent.click`. Remove its
   `vi.mock("react-native")` block. Keep the mocks for `expo-router`,
   `react-native-safe-area-context` and the store hooks where a test
   needs them. Import through `@/`. Example:

   ```tsx
   render(<TaskRow task={item} onOpen={onOpen} onToggle={onToggle} />);
   fireEvent.click(screen.getByRole("button", { name: "open task" }));
   expect(onOpen).toHaveBeenCalledWith(item);
   ```

   React Native Web drops `accessibilityState`, so a test cannot read
   `checked` or `selected` from it. Assert the label or the text
   instead. 0049 swaps the prop for `aria-*` props. Delete
   `src/test/rn-standin.ts` once no test imports it. If one file cannot
   move in this ticket, keep its stand-ins working, name it in Outcome,
   and open a ticket for it.

5. Add the `@/` alias for `src/`:
   - `app/tsconfig.json`: `"compilerOptions": { "paths": { "@/*": ["./src/*"] } }`.
   - Vitest: step 1 above.
   - Metro: Expo reads tsconfig `paths` on its own. Change one import in
     app code to `@/` and run both exports. Touch
     `app/metro.config.js` only if a bundle fails to resolve it. Its
     custom `resolveRequest` must keep the contracts rule.
   - ESLint: confirm `import/no-unresolved` accepts `@/` paths.

6. Add `.vitest/` to `app/.gitignore` under the Expo block (lines 6-10).

7. Clear the 54 warnings:
   - Turn `import/first` off for `**/*.test.ts` and `**/*.test.tsx` in
     `app/eslint.config.js`.
   - Move the 20 bottom and right margins to the parent. The parent
     spaces its children with `gap` or symmetric padding (ADR 0012).
     Compare each screen in the web preview before and after. Nothing
     may move by a pixel.
   - `PeriodStrip.tsx`: drop the local `STEP` at line 114 and use
     `periodStep` in both hooks.

8. Make the spacing rule an error. ADR 0012 says the rule turns into an
   error after the cleanup pass, and this ticket is that pass. Add
   `--max-warnings 0` to the ESLint step in `ci.yml` and to the eslint
   call in `.githooks/pre-commit:16`. A warning that CI ignores goes
   unread, as ADR 0026 found with Vale.

9. Record the wider rule in a dated amendment at the bottom of ADR 0012.
   The rule also covers `marginTop`, `marginLeft` and `marginVertical`.
   Today those match 33 sites in 10 files: `plannerStyles.ts` (7),
   `TaskEditorScreen.tsx` (6), `src/app/(tabs)/index.tsx` (5),
   `src/app/dev.tsx` (4), `BottomBar.tsx` (3), `CaptureChips.tsx` (2),
   `TaskRow.tsx` (2), `PreviewRow.tsx` (2), `PeriodStrip.tsx` (1),
   `ListPagePreview.tsx` (1). Phase 3 rebuilds most of these files, so
   the wider selector lands as an error in 0054, which clears the 33
   sites. We add no warn level in between, for the reason in step 8.

10. CI triggers:
    - `ci.yml`: `on: { push: { branches: [main, "epic/**"] }, pull_request: {} }`.
      The epic branch keeps a run after each squash merge.
    - `android.yml`: `workflow_dispatch` only. Remove the `push` block.

11. Scripts in `app/package.json`: `"test:unit": "vitest run --project unit"`
    and `"test:component": "vitest run --project component"`. `npm test`
    keeps running both.

## Acceptance

- [ ] `app/vitest.config.mts` replaces `app/vitest.config.ts`, and a run prints no Vite config warning.
- [ ] `npm run test:unit` runs the node tests and passes.
- [ ] `npm run test:component` runs in jsdom with `react-native` resolved to `react-native-web` and passes.
- [ ] `npm test` runs both projects and reports at least 261 passing tests.
- [ ] No component test calls `vi.mock("react-native")`, or Outcome names each exception and its follow-up ticket.
- [ ] No component test calls `props.onPress()` or finds a node by type name.
- [ ] `src/test/rn-standin.ts` is gone, or Outcome names the test that still imports it.
- [ ] A test imports through `@/`, and `tsc --noEmit` passes.
- [ ] An app module imports through `@/`, and `expo export --platform web` and `--platform android` both bundle it.
- [ ] `npx eslint src scripts --max-warnings 0` exits zero.
- [ ] A `marginBottom` or `marginRight` in a style fails ESLint as an error.
- [ ] Each screen with a spacing fix matches its before screenshot in the web preview.
- [ ] `.vitest/` is in `app/.gitignore`, and a JSON reporter run leaves `git status` clean.
- [ ] ADR 0012 has a dated amendment for the wider rule and names 0054 as the ticket that turns it on.
- [ ] A commit on a PR branch starts one CI run, not two.
- [ ] A push to main no longer starts `android.yml`, and the manual run still builds the APK.
- [ ] The pre-commit hook fails on an ESLint warning.

## Outcome
(filled in before moving to done/)
