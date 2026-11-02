# 0039. Import boundaries cover every layer

- **Status:** accepted
- **Date:** 2026-10-26

## Context

ADR 0001 chose the Bulletproof React layout. Bulletproof has one import
rule: code flows from shared modules to features to the app. Shared code
never imports a feature. A feature never imports another feature. Only
the app layer composes features.

We enforce a small part of that rule today. ADR 0020 checks `src/lib`
alone, and it lets type-only imports through. ADR 0022 put the store in
`src/store`, and no rule checks the store or `src/components`.

An audit on 2026-10-26 parsed every import in `app/src` at commit
`b2c0b10`. In source files, 66 imports break the Bulletproof rule. Tests
add 20 more.

| Edge | Runtime | Type-only |
|---|---|---|
| Shared code to a feature | 14 | 15 |
| Feature to feature | 17 | 20 |

The store imports six of the seven features. Five folders form one
import cycle: the store, `tasks`, `vault`, `lists` and `task-editor`. Our
lint rule caught none of it. It skips the 35 type-only imports, and the
31 runtime imports sit outside `src/lib`.

Two of the seven features hold no UI. `tasks` and `vault` are the data
layer, and every screen reads them.

## Decision

We apply the Bulletproof rule to every layer, and type-only imports
count. The check is `import/no-restricted-paths` from
`eslint-plugin-import`, which `eslint-config-expo` already brings in.

The layout:

| Folder | Holds |
|---|---|
| `src/app` | expo-router routes and the providers. A route re-exports one screen or composes features in a few lines. |
| `src/features/<name>` | The UI of one feature: `capture`, `diagnostics`, `lists`, `planner`, `task-editor`. |
| `src/components` | Shared UI. `components/ui` holds the primitives. |
| `src/hooks` | Shared hooks. |
| `src/stores/tasks` | The task query, the mutation hooks, pure row updaters, selectors and the reminder sync. |
| `src/lib` | Libraries set up for this app: `vault` (SAF access, note files, the frontmatter writer, file names), `react-query`, `recurrence`, `notifications`, `motion`. |
| `src/types` | Shared types, such as `TaskItem`. |
| `src/utils` | Pure helpers: dates, YAML, schema errors. |
| `src/theme` | Design tokens. |
| `src/testing` | Test setup and regression tests that cross layers. |

The zones:

1. A feature imports no other feature.
2. A feature imports nothing from `src/app`.
3. The shared folders import no feature and nothing from `src/app`. The
   shared folders are `components`, `hooks`, `lib`, `stores`, `theme`,
   `types` and `utils`.
4. The bottom folders import nothing from `components`, `hooks` or
   `stores`. The bottom folders are `lib`, `utils`, `types` and `theme`.

`src/testing` has no zone. App code does not import it.

Three rules go with the zones:

- Imports across folders use the `@/` alias. ESLint resolves it with the
  TypeScript resolver. The node resolver in `eslint-config-expo` cannot
  read `@/`, and the zones rule then skips those imports without a word.
- File and folder names use kebab-case. `eslint-plugin-check-file`
  checks them. Route files under `src/app` keep the names expo-router
  needs.
- We add no barrel files. A module imports the file it needs.

The config block in `app/eslint.config.js`:

```js
const fs = require("node:fs");
const path = require("node:path");
const checkFile = require("eslint-plugin-check-file");

const features = fs.readdirSync(path.join(__dirname, "src/features"));
const shared = ["components", "hooks", "lib", "stores", "theme", "types", "utils"]
  .map((dir) => `./src/${dir}`);

// ...inside defineConfig([...]):
{
  files: ["src/**/*.{ts,tsx}"],
  settings: {
    "import/resolver": {
      typescript: { project: "./tsconfig.json" },
      node: true,
    },
  },
  rules: {
    "import/no-restricted-paths": ["error", {
      zones: [
        ...features.map((name) => ({
          target: `./src/features/${name}`,
          from: "./src/features",
          except: [`./${name}`],
          message: "A feature never imports another feature (ADR 0039).",
        })),
        { target: "./src/features", from: "./src/app",
          message: "A feature never imports a route (ADR 0039)." },
        { target: shared, from: ["./src/features", "./src/app"],
          message: "Shared code never imports a feature or a route (ADR 0039)." },
        { target: ["./src/lib", "./src/utils", "./src/types", "./src/theme"],
          from: ["./src/components", "./src/hooks", "./src/stores"],
          message: "lib, utils, types and theme sit at the bottom (ADR 0039)." },
      ],
    }],
  },
},
{
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/app/**"],
  plugins: { "check-file": checkFile },
  rules: {
    "check-file/filename-naming-convention": ["error",
      { "src/**/*.{ts,tsx}": "KEBAB_CASE" }, { ignoreMiddleExtensions: true }],
    "check-file/folder-naming-convention": ["error",
      { "src/!(app)/**/": "KEBAB_CASE" }],
  },
},
```

We rejected a `features/tasks` core feature that every other feature may
import. Each feature zone would need an exception for it. The data layer
would sit in `features` while it serves every screen. With the task data
in `stores`, `lib` and `types`, the Bulletproof rule holds with no
exception.

We rejected an `index.ts` barrel for each feature. Bulletproof now
advises direct imports. Metro loads every module a barrel names. And the
zones already limit who imports a feature: only `src/app` may.

We rejected the type exemption from ADR 0020. The coupling started with
types: 35 of the 66 imports carry types only. With the shared types in
`src/types`, a type import from a feature shows a real dependency.

## Consequences

A build fails on any new import across a boundary, so the folder cycle
cannot come back. A feature can change or go away and leave the other
features alone. When one feature needs the UI of another, the route
passes it in as a prop.

`src/stores/tasks` becomes the largest shared module, and every screen
depends on it. We accept that, because the app has one data domain.

The zone list reads `src/features` from disk, so a new feature gets its
zone with no config change. `src/testing` has no zone, so a regression
test there may import any layer.

`eslint-plugin-check-file` is one more dev dependency. Version 3.3.2
runs on ESLint 9 with the flat config.

Ticket 0050 turns the rule on at error. CI runs ESLint with
`--max-warnings 0` (ticket 0048), so a warn level would fail every run.
Four imports still break the rule when 0050 lands. Each one carries an
`eslint-disable-next-line` comment that names the ticket that removes
it: 0052 for the two in the store, 0057 for the two in `BottomBar`.
