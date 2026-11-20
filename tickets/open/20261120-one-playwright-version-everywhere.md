---
title: One Playwright version across the repos
created: 2026-11-20
priority: normal
assignee:
pr:
depends: []
---

## Spec

The repos share one Playwright browser cache at
`~/.cache/ms-playwright`. Each repo pins its own `@playwright/test`.
One repo's `playwright install` then prunes the build another repo
needs.

Two suites hit this on 2026-11-20. `monkey-budget` ran an install that
removed `chromium_headless_shell-1248`; a monkey-tasks gate then failed
mid-suite. The same class broke three gate runs earlier in the day.

The template already shares scripts byte for byte. Share the pin too:

- `project-template` owns a Playwright version, in its `package.json`
  or a file the shared scripts read.
- `sync-template.sh` lists it, so each repo's pin follows the template.
- The skills' setup checks the browser for that version, as
  monkey-tasks' `worktree-setup.sh` already does.

## Acceptance

- [ ] The template names one Playwright version, with a reason.
- [ ] A repo's sync moves its pin to match, proven on one repo.
- [ ] A second repo's install no longer prunes the first's build,
      shown in a throwaway cache.

## Outcome

(filled in before moving to done/)
