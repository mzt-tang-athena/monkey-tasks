# Notes for agents working in this repo

Read `README.md` first. The ADRs in `docs/adr/` are the
decision record. The tickets in `tickets/` are the work queue.

## Commands

- Set up a linked worktree with `scripts/worktree-setup.sh`. It links
  `node_modules`, inits `contracts`, builds the schemas and syncs Vale.
- Run `scripts/gate.sh` before a PR. It runs the repo's checks and
  leaves a receipt for HEAD. The steps live in the `lint` and `ci`
  Makefile targets: `ci` adds tsc, eslint, vitest and the web suite.
  Prose-only changes get `fast`.

## Rules for any change

0. Workflow: do not push to main. Work on a branch, open a PR, wait for
   CI, and squash-merge when green. Branch protection is not available
   on the free plan. This rule is convention only, because nothing
   enforces it.
1. All work starts as a ticket. Claim one by moving it to `tickets/doing/`
   and filling `assignee` in the same commit. The rules live in
   `tickets/README.md`.
2. Write an ADR the same day a decision carries a trade-off. That means
   an alternative existed, and a future agent could plausibly reopen it.
   Copy `docs/adr/adr-template.md` to `YYYYMMDD-short-title.md`. Record
   later changes as dated amendments at the bottom of the same file
   (never rewrite the original decision). A legacy `NNNN` file keeps its name. Adjustments with no real
   alternative only need a commit.
3. Write docs in the ADR template's plain style: short sentences, active
   voice, plain words, no em dashes. A bullet fits one phone line, about
   60 characters. `scripts/check-changelog.sh` enforces it for the
   changelog, which becomes the release notes.
4. Keep `README.md` current. The README is the source of truth for what
   this project is and what comes next.
5. Never run sudo. Never commit secrets or tokens.
