---
title: Worktree setup ensures the pinned Playwright browser
created: 2026-11-20
priority: high
assignee: omp
pr:
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

- [ ] setup checks the build the installed Playwright wants
- [ ] setup installs only on a miss, and says which
- [ ] a warm run installs nothing and says so
- [ ] `AGENTS.md` tells the main checkout how to get the browser
- [ ] with an empty `PLAYWRIGHT_BROWSERS_PATH`, setup installs the
      wanted build and the web suite launches

## Outcome

(filled in before moving to done/)
