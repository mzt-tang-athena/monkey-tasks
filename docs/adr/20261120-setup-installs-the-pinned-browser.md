# Worktree setup installs the pinned browser

- **Status:** accepted
- **Date:** 2026-11-20

## Context

The web suite launches Chromium through `@playwright/test`.
The repo pins that package. Each version wants one exact browser build.
Playwright keeps its builds in one cache, shared by every checkout.
Nothing checked the cache against the pin.

On 2026-11-20 three full gates failed at launch. Every e2e test failed
at once, because the cache held build 1234 and the pin wanted 1248.
A worktree made the gap worse. Setup links `node_modules`, so the lane
looks ready and then fails minutes into its first gate.

## Decision

`scripts/worktree-setup.sh` ensures the browser after it links
`node_modules`.
It asks the installed runner where its builds belong, with
`playwright install chromium --dry-run`, then tests each path.
On a miss it runs `playwright install chromium`.
On a warm machine it prints that the browsers are present and does
nothing else.

The main checkout gets the command in `AGENTS.md`, not in the gate.
The gate runs once per branch on a machine that setup has already
fixed. Setup is the place a checkout becomes usable.

Rejected: put the install in `scripts/gate.sh`. That file is the same
byte for byte in every repo from `project-template`. A browser is a
fact about this one.

Rejected: run the install on every setup. Setup then cannot say
whether it changed anything, and a stale cache stays invisible.

## Consequences

A fresh worktree can run the web suite on its first try.
The first setup on a stale machine downloads about 120 MB, and says
which build it fetched.

The check reads the `--dry-run` text. If a Playwright update changes
that text, setup installs when it did not need to. It stays correct
and it gets slower, and nothing fails silently.

One gap stays. A main checkout that skips the `AGENTS.md` command
still fails its gate at launch, because `gate.sh` does not look.
