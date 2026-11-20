---
title: Worktree setup ensures the pinned Playwright browser
created: 2026-11-20
priority: high
assignee: omp
pr: 198
depends: []
---

## Spec

On 2026-11-20 three full gates failed with every e2e test failing at
launch:

    browserType.launch: Executable doesn't exist at
    ~/.cache/ms-playwright/chromium_headless_shell-1248/...

The machine's cache held build 1234. The pinned `@playwright/test`
1.64.1 wants 1248. `scripts/worktree-setup.sh` links `node_modules`
but never looks at the browser cache. Every fresh worktree inherits
the gap, and the failure lands in the gate, minutes into a run.

Make setup own the browser as it owns the other shared pieces. Check
the build the installed Playwright wants. Install only on a miss, and
print what it did. A warm machine should do nothing.

The main checkout hit the same gap, so name the command there too.

## Acceptance

- [x] setup checks the build the installed Playwright wants
- [x] setup installs only on a miss, and says which
- [x] a warm run installs nothing and says so
- [x] `AGENTS.md` tells the main checkout how to get the browser
- [x] with an empty `PLAYWRIGHT_BROWSERS_PATH`, setup installs the
      wanted build and the web suite launches

## Outcome

Shipped in #198.

- Setup ensures the browser after it links `node_modules`. It asks the
  installed runner where its builds belong, tests each path, and
  installs only on a miss.
- Warm run: `playwright browsers present`, one second, no download.
- With a throwaway `PLAYWRIGHT_BROWSERS_PATH`, removing
  `chromium_headless_shell-1248` made setup name the build, install it
  and print `browsers ready`. The suite ran on that cache:
  `a11y.spec.ts`, 43 passed.
- `AGENTS.md` names the command for the main checkout, which setup
  skips.
- ADR `20261120-setup-installs-the-pinned-browser` records the choice.
- `scripts/gate.sh full` passed at the code head in 1188 s. This close
  commit is prose, so it gets `fast`.
