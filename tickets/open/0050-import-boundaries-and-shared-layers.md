---
id: 0050
title: Import boundaries and shared layers
created: 2026-10-26
priority: high
assignee:
pr:
depends: [0048, 0049]
---

## Spec

Phase 1 of the rebuild (0047). ADR 0039 records the decision. This
ticket moves the code into the Bulletproof layout, renames files to
kebab-case and turns on the import boundary rule.

The change keeps behaviour as it is. We move files, rename them, merge
copies of the same helper and delete dead code. No logic changes. Tests
change only in import paths, imported names, `vi.mock` paths and file
location. The one exception: the 8 tests of the dead `nextDue` go with
it.

Paths and line numbers cite commit `b2c0b10`. Tickets 0048 and 0049 land
first and touch some test files, so take a fresh baseline before the
first move (step 1).

### Baseline at `b2c0b10`

Two tools agree on these counts: the ESLint zones from ADR 0039 and the
graph script under "Scripts". Neither counts `src/testing`.

- 66 imports in source files break the layering: 31 runtime, 35
  type-only.
- 20 imports in test files break it: 8 runtime, 12 type-only.
- 43 file names fail kebab-case: 34 source files and 9 test files. No
  folder fails.
- Runtime imports in source files form two folder cycles:
  - `store`, `features/tasks`, `features/vault`, `features/lists` and
    `features/task-editor`. Example: `vault/session.ts:3` imports
    `tasks/query.ts`, and `tasks/query.ts:2` imports `vault/scan.ts`.
  - `components` and `features/capture`. `BottomBar.tsx:14-15` imports
    capture, and `CaptureSheet.tsx:16` imports `components/ui`.
- `app/eslint.config.js:22-45` checks `src/lib` only. Line 36 lets
  type-only imports pass.
- `tsc` passes, and 261 tests pass.

| From | To | Runtime | Type-only | Where |
|---|---|---|---|---|
| `store` | six features | 12 | 9 | `tasks.tsx:22-52`, `task-state.tsx:2-3`, `task-actions.tsx:3-6`, `selectors.ts:2` |
| `components` | `capture`, `tasks` | 2 | 4 | `BottomBar.tsx:12-15`, `TaskRow.tsx:10`, `PreviewRow.tsx:3` |
| `lib` | `lists`, `tasks` | 0 | 2 | `mock.ts:2-3` |
| `planner` | `tasks`, `capture` | 4 | 15 | `DaySpread.tsx:11`, `MonthGrid.tsx:6`, `usePlannerMonth.ts:3`, `model.ts:4`, 14 imports of `TaskItem`, `PlannerScreen.tsx:6` |
| `tasks` | `vault`, `capture` | 5 | 0 | `query.ts:2-3`, `patch.ts:2`, `spawn.ts:1-2` |
| `task-editor` | `vault`, `capture`, `tasks` | 4 | 2 | `save.ts:3-4`, `save.ts:11-12`, `TaskEditorScreen.tsx:17-18` |
| `lists` | `vault`, `tasks` | 2 | 2 | `query.ts:2-3`, `reorder.ts:1`, `ListPagePreview.tsx:18` |
| `vault` | `lists`, `tasks` | 2 | 0 | `session.ts:2-3` |
| `reminders` | `tasks` | 0 | 1 | `sync.ts:4` |

### Move map

All paths sit under `app/src/`. A test file moves and renames with its
subject.

| From | To | Note |
|---|---|---|
| `store/tasks.tsx` | `stores/tasks/tasks-provider.tsx` | Still one file. Ticket 0052 splits it. |
| `store/task-state.tsx`, `store/task-actions.tsx` | `stores/tasks/` | Same names. |
| `store/selectors.ts` | `stores/tasks/selectors.ts` | Also takes `inList`, `DateGroups` and `groupByDue` from `features/tasks/query.ts:77-149`. |
| `store/query-client.ts` | `lib/react-query.ts` | |
| `features/vault/grant.ts`, `scan.ts`, `notes.ts` | `lib/vault/` | `notes.ts` keeps the file I/O, lines 1-96. |
| `features/vault/notes.ts:98-189` | `lib/vault/frontmatter.ts` | `frontmatterSpan`, `updateProperty`, `replaceSpan`. See step 9. |
| `features/capture/write.ts:39` (`safeFileName`) | `lib/vault/file-name.ts` | |
| `features/task-editor/save.ts:40` (`parentUri`), `save.ts:81-116` (`renameNote`) | `lib/vault/rename.ts` | Export `renameNote`. The `parentUri` tests (`save.test.ts:95-122`) move to `rename.test.ts`. |
| `features/vault/session.ts` | `stores/tasks/load-vault.ts` | |
| `features/tasks/query.ts` | `stores/tasks/task-notes.ts` | `taskFromText` and `loadTasks`. |
| `features/lists/query.ts` | `stores/tasks/list-notes.ts` | `parseListNote`, `loadLists` and `ListRead`. |
| `features/tasks/patch.ts`, `spawn.ts` | `stores/tasks/` | Same names. |
| `features/tasks/recurrence.ts` | `lib/recurrence.ts` | Without `nextDue`. |
| `features/reminders/schedule.ts` | `lib/notifications.ts` | |
| `features/reminders/sync.ts` | `stores/tasks/reminder-sync.ts` | |
| `lib/dates.ts`, `lib/yaml.ts`, `lib/schema-errors.ts` | `utils/` | Same names. |
| `lib/dropzone.ts` | `features/planner/lib/dropzone.ts` | The planner is its one user. |
| `lib/insights.ts` | `features/diagnostics/hooks/use-insights.ts` | `app/dev.tsx` is its one user. |
| `app/dev.tsx` | `features/diagnostics/components/diagnostics-screen.tsx` | `dev.tsx` keeps one re-export line. |
| `test/rn-standin.ts` | `testing/rn-standin.ts` | Only if 0048 kept it. |
| `../vitest.stub.ts` | `testing/expo-file-system-stub.ts` | Point the Vitest alias at it. |

The new file `types/task.ts` takes these types as they are:

| Type | From |
|---|---|
| `TaskItem` | `features/tasks/query.ts:7-27` |
| `ListItem`, `BrokenList` | `features/lists/query.ts:7-20` |
| `CaptureTarget` | `features/capture/write.ts:29-31` |
| `ParsedCapture` | `features/capture/parse.ts:12-24` |
| `TaskEdit` | `features/task-editor/save.ts:17-24` |

These files keep their place:

- `lib/errors.ts`, `lib/settings.ts` and `lib/swipe.ts`.
- `lib/motion.ts`. Ticket 0058 rebuilds it as `lib/motion/`.
- `lib/mock.ts`. Ticket 0051 replaces it with the memory adapter, and
  the 0049 suite drives the preview it feeds.

### Work

Land the ticket as three PRs into `epic/0047-rebuild`, in this order.
Each PR keeps the app working and passes typecheck, lint, Vitest and the
0049 Playwright suite.

**PR 1: shared types, helpers and dead code.**

1. Take the baseline. Run the scripts under "Scripts" and put the
   numbers in the PR description.
2. Check the `@/` alias from 0048 in tsconfig, Vitest and Metro. If
   0048 landed without it, add it here:
   - `app/tsconfig.json`: `"paths": { "@/*": ["./src/*"] }`. Add no
     `baseUrl`, because TypeScript 6 deprecates it.
   - Vitest: `{ find: /^@\//, replacement: `${src}/` }` in the alias
     list.
   - Metro: Expo reads tsconfig `paths` on its own.
     `experiments.tsconfigPaths` defaults to true
     (`@expo/cli/build/src/start/server/metro/instantiateMetro.js:310`).
3. Add the TypeScript resolver to the ESLint settings, as in ADR 0039.
   `eslint-config-expo` sets the node resolver only, and that resolver
   cannot read `@/`. The zones rule then skips every aliased import with
   no error. A probe on 2026-10-26 showed it: one `@/` import that broke
   a zone gave an error under the TypeScript resolver and nothing under
   the node resolver. `eslint-import-resolver-typescript` 3.10.1 already
   comes with `eslint-config-expo`.
4. Create `types/task.ts` from the table above. Point every importer at
   `@/types/task`.
5. Create `utils/` and move `dates.ts`, `yaml.ts` and `schema-errors.ts`
   into it.
6. Merge the copies:
   - `formatTime`: keep one in `utils/dates.ts`. The copies sit in
     `TaskRow.tsx:243`, `PreviewRow.tsx:70`, `planner/model.ts:199` and
     `capture/lib/chipLabels.ts:32`, where it has the name
     `formatClock`. Move the `formatClock` tests
     (`chipLabels.test.ts:34-46`) to `utils/dates.test.ts` under the
     name `formatTime`. Ticket 0054 expects this one copy.
   - `startOfToday`: `TaskRow.tsx:238` and `PreviewRow.tsx:65`. Keep one
     in `utils/dates.ts`.
   - `isoOf`: `planner/model.ts:205` gives the same result as
     `formatLocal(date, false)` in `lib/dates.ts:3`. Move `isoOf` to
     `utils/dates.ts` and make it call `formatLocal`. Keep the name,
     because six planner files import it.
   - `pointerPickup`: `planner/hooks/useTouchDragGate.ts:20` copies
     `planner/components/drag.tsx:53`. Import the one in `drag.tsx`.
7. Delete dead code:
   - `nextDue` (`features/tasks/recurrence.ts:89-119`) has no caller
     outside its tests. Production calls `nextAfter`. Delete `nextDue`
     and its 8 tests (`recurrence.test.ts:45-109`).
   - Drop `export` from nine values that no other file imports:
     `liftStyleOf` and `NativeDragHandle` (`drag.tsx:24`, `drag.tsx:69`),
     `RULER_START` and `RULER_END` (`Timeline.tsx:12-13`),
     `ensureChannel` (`schedule.ts:24`), `saveVaultUri` (`grant.ts:17`),
     `isDirectoryUri` (`scan.ts:28`), `byManualOrder`
     (`selectors.ts:96`) and `activeTheme` (`tokens.ts:90`).
   - Eleven exported types have no outside importer either. Each one
     names a parameter or a return value of an exported function, so
     they keep `export`.
   - Delete the barrel `components/ui/index.ts`. Its two importers,
     `app/(tabs)/index.tsx:37` and `CaptureSheet.tsx:16`, import the
     files.
   - `store/task-actions.tsx:24-29` stacks two doc comments on `edit`.
     Merge them into one.
8. Change every import that leaves its folder to `@/`. An import inside
   one folder keeps `./`. PR 1 removes every type-only hit. At
   `b2c0b10` that leaves 31 runtime hits in source files and 8 in
   tests.

**PR 2: shared layers and the rule.**

9. Create `lib/vault/`. Move `grant.ts`, `scan.ts` and `notes.ts` into
   it. Split the frontmatter writer out of `notes.ts` into
   `frontmatter.ts`, and keep one copy of each helper there:
   - `replaceBody`: `store/tasks.tsx:123-133` and
     `task-editor/save.ts:60-70`.
   - `setBlockList`: `store/tasks.tsx:111-116` and
     `task-editor/save.ts:124-129`.
   - The frontmatter regex: `store/tasks.tsx:103`,
     `task-editor/save.ts:26` and `notes.ts:107`. Keep the one in
     `frontmatterSpan`. `replaceBody` cuts the text at the span end.
     `editMockTask` (`store/tasks.tsx:146`) checks for a span instead of
     the regex.

   Move the `updateProperty` tests (`notes.test.ts:112-199`) to
   `frontmatter.test.ts`. Add `file-name.ts` and `rename.ts` from the
   move map.
10. Create `stores/tasks/` from the move map. Change the Vitest project
    globs from 0048 (`src/store/**`) to `src/stores/**`. Change the
    `vi.mock` paths in the tests that move.
11. Move `recurrence`, `notifications` and `react-query` into `lib/`,
    `dropzone` into the planner, `diagnostics` into `features/`, and the
    test support into `testing/`.
12. Point `lib/mock.ts` at `@/types/task`. It keeps its place.
13. Replace the ADR 0020 block in `app/eslint.config.js` (lines 22-45)
    with the zones block from ADR 0039, at `error`. Four imports still
    break a zone. Put a comment above each one, of the form
    `// eslint-disable-next-line import/no-restricted-paths -- 0052 moves this`:

    | File | Import | Ticket that removes it |
    |---|---|---|
    | `stores/tasks/tasks-provider.tsx` | `captureDraft` from `features/capture/write.ts` | 0052 |
    | `stores/tasks/tasks-provider.tsx` | `saveTaskEdit` from `features/task-editor/save.ts` | 0052 |
    | `components/BottomBar.tsx` | `CaptureSheet` | 0057 |
    | `components/BottomBar.tsx` | `useCaptureDraft` | 0057 |

    We use `error` with named exceptions, not `warn`. 0048 runs ESLint
    with `--max-warnings 0`, so a warning fails CI. ESLint 9 reports a
    disable comment that no longer hides an error, so 0052 and 0057
    cannot leave one behind.
14. Prove that the rule fires. In a scratch change that you do not
    commit, add `import { parseCapture } from "@/features/capture/parse";`
    to `stores/tasks/selectors.ts`. ESLint must report an error.

**PR 3: kebab-case.**

15. Rename the 43 files. A test file follows its subject.
    - `components/`: `BottomBar`, `ErrorBoundary`, `PreviewRow`,
      `SwipePager`, `TaskRow`, `ui/Button`, `ui/IconButton`, `ui/Pill`.
    - `features/capture/`: `components/CaptureChips`,
      `components/CaptureSheet`, `hooks/useCaptureDraft`,
      `lib/chipLabels`.
    - `features/lists/`: `ListPagePreview`, `ReorderRow`.
    - `features/planner/`: `PlannerScreen`.
    - `features/planner/components/`: `DayPreview`, `DaySpread`,
      `FormToggle`, `MonthGrid`, `MonthView`, `PeriodStrip`,
      `PlannerHeader`, `PlannerStates`, `SourceToggle`,
      `TaskListSection`, `TaskPills`, `Timeline`, `WeekView`,
      `plannerStyles`.
    - `features/planner/hooks/`: `usePlannerGestures`,
      `usePlannerMonth`, `usePlannerRoute`, `useTouchDragGate`.
    - `features/task-editor/`: `TaskEditorScreen`.

    The new name splits at each capital: `TaskRow.tsx` becomes
    `task-row.tsx`, and `useCaptureDraft.ts` becomes
    `use-capture-draft.ts`. Use `git mv`. macOS ignores case in file
    names, so three names that change only in case need two steps:
    `Button.tsx`, `Pill.tsx` and `Timeline.tsx`. For example,
    `git mv Button.tsx button.tmp.tsx`, then
    `git mv button.tmp.tsx button.tsx`.
16. Add `eslint-plugin-check-file@3.3.2` as a dev dependency. Add the
    check-file block from ADR 0039 at `error`. Version 3.3.2 needs
    ESLint 9 or later and runs with the flat config. A probe on
    2026-10-26 ran it on this tree with ESLint 9.39.5. It flagged the 43
    files and no folder. It skipped `src/app/(tabs)/_layout.tsx` and
    `src/app/task/[id].tsx`, and it accepted `x.test.ts` names.
17. Change the "Layout" section of `README.md` to match ADR 0039.

### Out of scope

| Item | Ticket |
|---|---|
| Split `tasks-provider.tsx`. Move `captureDraft` and `saveTaskEdit` into mutation hooks. | 0052 |
| Replace `lib/mock.ts` with the memory adapter. | 0051 |
| `TaskRowFace`. `toneLabel` (`app/(tabs)/index.tsx:1080`, `ListPagePreview.tsx:109`) goes into `SectionHeader`. | 0054 |
| The Lists screen, with its reorder hold at `app/(tabs)/index.tsx:307-400`. | 0055 |
| Split `plannerStyles.ts`. | 0056 |
| Move `BottomBar` into `capture`. | 0057 |
| The planner hold gate. `DaySpread.tsx:198-213` copies `usePlannerGestures.ts:84-99`, and the two copies already differ. For a pill, the move check at `DaySpread.tsx:437-450` waits `drag.pickMs`, and the one at `usePlannerGestures.ts:250-260` waits `drag.pillPickMs`. A merge would change behaviour, and the gesture handler 3 rebuild replaces both. | Phase 4, 0058 to 0062 |
| The 54 lint warnings at `b2c0b10`. | 0048 |

### Scripts

Keep these outside the repo, and run them from `app/`. They need no
install: `eslint`, `typescript` and the resolver already sit in
`app/node_modules`.

The boundary count. It wraps the repo config, so it works before and
after the rule lands. The list holds today's folder name `store` and
the new name `stores`.

```js
// zones-count.cjs
// npx eslint -c /path/zones-count.cjs -f json src | node /path/zones-tally.cjs
const fs = require("node:fs");
const path = require("node:path");
const app = process.cwd();
const base = require(path.join(app, "eslint.config.js"));
const features = fs.readdirSync(path.join(app, "src/features"));
const shared = ["components", "hooks", "lib", "store", "stores", "theme", "types", "utils"]
  .map((dir) => `./src/${dir}`);
module.exports = [
  ...base,
  {
    files: ["src/**/*.{ts,tsx}"],
    settings: {
      "import/resolver": {
        typescript: { project: path.join(app, "tsconfig.json") },
        node: true,
      },
    },
    rules: {
      "import/no-restricted-paths": ["warn", { zones: [
        ...features.map((f) => ({ target: `./src/features/${f}`, from: "./src/features", except: [`./${f}`] })),
        { target: "./src/features", from: "./src/app" },
        { target: shared, from: ["./src/features", "./src/app"] },
        { target: ["./src/lib", "./src/utils", "./src/types", "./src/theme"],
          from: ["./src/components", "./src/hooks", "./src/store", "./src/stores"] },
      ] }],
    },
  },
];
```

```js
// zones-tally.cjs: reads ESLint JSON on stdin, prints each hit and the totals.
let raw = "";
process.stdin.on("data", (d) => (raw += d)).on("end", () => {
  const totals = { source: 0, test: 0 };
  for (const file of JSON.parse(raw)) {
    for (const m of file.messages) {
      if (m.ruleId !== "import/no-restricted-paths") continue;
      totals[/\.test\.tsx?$/.test(file.filePath) ? "test" : "source"] += 1;
      const where = file.filePath.slice(file.filePath.indexOf("/src/") + 1);
      console.log(`${where}:${m.line} ${m.message.match(/"([^"]+)"/)[1]}`);
    }
  }
  console.log(totals);
});
```

The layer graph. It parses each import with the TypeScript compiler,
splits runtime from type-only imports and prints the folder cycles. It
reads `@/` paths too.

```js
// layer-graph.cjs: node /path/layer-graph.cjs
const ts = require(require.resolve("typescript", { paths: [process.cwd()] }));
const fs = require("node:fs"), path = require("node:path");
const SRC = path.resolve("src");
const SHARED = ["components", "hooks", "lib", "store", "stores", "theme", "types", "utils"];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []);
const layer = (f) => { const [a, b] = path.relative(SRC, f).split(path.sep); return a === "features" ? `features/${b}` : a; };
function resolve(from, spec) {
  const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2))
    : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
    .find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}
const edges = [];
for (const f of walk(SRC)) {
  const sf = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true);
  const add = (node, spec, typeOnly) => {
    const to = resolve(f, spec);
    if (to) edges.push({ f, to, typeOnly, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
  };
  sf.forEachChild(function visit(n) {
    if (ts.isImportDeclaration(n)) {
      const c = n.importClause;
      const named = c?.namedBindings && ts.isNamedImports(c.namedBindings) ? c.namedBindings.elements : [];
      add(n, n.moduleSpecifier.text, !!c && (c.isTypeOnly || (!c.name && named.length > 0 && named.every((e) => e.isTypeOnly))));
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier) add(n, n.moduleSpecifier.text, n.isTypeOnly);
    ts.forEachChild(n, visit);
  });
}
const verdict = (a, b) => a === b || a === "testing" ? null
  : SHARED.includes(a) && (b === "app" || b.startsWith("features/")) ? "shared->feature"
  : a.startsWith("features/") && b.startsWith("features/") ? "feature->feature"
  : a.startsWith("features/") && b === "app" ? "feature->app" : null;
const tally = {}, graph = {};
for (const e of edges) {
  const a = layer(e.f), b = layer(e.to), v = verdict(a, b), test = /\.test\.tsx?$/.test(e.f);
  if (a !== b && !e.typeOnly && !test) (graph[a] ??= new Set()).add(b);
  if (!v) continue;
  const k = `${v} ${e.typeOnly ? "type" : "runtime"}${test ? " (test)" : ""}`;
  tally[k] = (tally[k] ?? 0) + 1;
  console.log(`${k}\t${path.relative(SRC, e.f)}:${e.line} -> ${path.relative(SRC, e.to)}`);
}
console.log(edges.length, "edges", tally);
// Folder cycles: Tarjan's strongly connected components over runtime imports in source files.
let i = 0; const idx = {}, low = {}, stack = [], on = new Set(), cycles = [];
function scc(v) {
  idx[v] = low[v] = i++; stack.push(v); on.add(v);
  for (const w of graph[v] ?? []) {
    if (idx[w] === undefined) { scc(w); low[v] = Math.min(low[v], low[w]); }
    else if (on.has(w)) low[v] = Math.min(low[v], idx[w]);
  }
  if (low[v] === idx[v]) {
    const c = []; let w;
    do { w = stack.pop(); on.delete(w); c.push(w); } while (w !== v);
    if (c.length > 1) cycles.push(c);
  }
}
Object.keys(graph).forEach((v) => idx[v] === undefined && scc(v));
console.log("layer cycles", JSON.stringify(cycles));
```

At `b2c0b10` the graph script prints 15 shared-to-feature type imports,
14 shared-to-feature runtime imports, 20 feature-to-feature type imports
and 17 feature-to-feature runtime imports in source files. It prints the
two folder cycles from the baseline.

## Acceptance

- [ ] `src/types/task.ts` declares `TaskItem`, `ListItem`, `BrokenList`, `CaptureTarget`, `ParsedCapture` and `TaskEdit`, and no other file declares them.
- [ ] `src/features` holds `capture`, `diagnostics`, `lists`, `planner` and `task-editor`, and nothing else.
- [ ] `src/store`, `src/test`, `app/vitest.stub.ts`, and the five `lib` files that leave (`dates`, `yaml`, `schema-errors`, `dropzone`, `insights`) no longer exist.
- [ ] The source holds one `replaceBody`, one `setBlockList`, one frontmatter regex, one `formatTime`, one `startOfToday`, one `isoOf` and one `pointerPickup`.
- [ ] `nextDue`, its 8 tests and `components/ui/index.ts` no longer exist, and the nine values in step 7 have no `export`.
- [ ] No import leaves its folder through `../`.
- [ ] `app/eslint.config.js` holds the ADR 0039 block at `error` with the TypeScript resolver, and no longer holds the ADR 0020 block.
- [ ] Exactly four `eslint-disable-next-line import/no-restricted-paths` comments exist, and each one names 0052 or 0057.
- [ ] The scratch import in step 14 fails ESLint with an error.
- [ ] A scratch file `src/lib/BadName.ts` and a scratch folder `src/lib/badFolder/` each fail ESLint.
- [ ] The graph script lists only the four imports from step 13. Its folder cycles are `components` with `features/capture` (0057) and `stores` with `features/task-editor` (0052).
- [ ] `npx eslint src scripts --max-warnings 0` exits zero.
- [ ] `tsc --noEmit` passes.
- [ ] Vitest passes, with the test count after 0048 minus the 8 `nextDue` tests.
- [ ] Apart from the deleted `nextDue` tests, test files change only in import paths, imported names, `vi.mock` paths and location.
- [ ] The 0049 Playwright suite gives the same results before and after each PR.
- [ ] `npx expo export --platform web` and `npx expo export --platform android` both bundle.
- [ ] Each PR description records the boundary count before and after the PR.
- [ ] The "Layout" section of `README.md` matches ADR 0039.

## Outcome

(filled in before moving to done/)
