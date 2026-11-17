# Continue epic 0047 on another machine

Read the amendment of 2026-11-07 at the end of this guide before you
act. It changes the plan below.

This guide moves the epic 0047 work to a new machine or a new Claude Code
account. It also lists the steps that finish the epic. The state below is
from 2026-11-07.

The epic plan is
[ticket 0047](../tickets/doing/0047-bulletproof-refactor-and-motion-rebuild.md).
Its decisions are in ADRs 0035 to 0042. The live checklist is the body of
PR #68.

## State on 2026-11-07

| Phase | Tickets | State |
|---|---|---|
| 0. Safety net | 0048, 0049, 0053, 0068 | Merged |
| 1. Layout | 0050 | Merged |
| 2. Data | 0051, 0052, 0066, 0067 | Merged |
| 3. Screens | 0054, 0056 | Merged |
| 3. Screens | 0055 (PR #81), 0057 (PR #80) | Open. Each failed its re-review on one blocking issue. The issue is the latest comment on the PR. |
| 4. Motion | 0058 to 0062 | Not started. 0058 depends on 0055 and 0057. |
| 5. Access | 0063 | Not started |

The tip of `epic/0047-rebuild` was `7c079a2` before this guide merged.

## Start here

This guide and the phase scripts are on the branch
`docs/epic-0047-handover` (PR #86). PR #86 is not merged yet. Do these
steps first, from that branch:

1. Verify the last commit on the branch. Nobody ran it.
   - It changes one e2e test to wait for the settled layout. The test is
     "the day list keeps its source toggle above the bottom bar"
     (`app/e2e/specs/planner-split.spec.ts:56`). The old test failed PR #86's e2e-web check
     about once in 20 runs, under load.
   - The cause is a real one-frame jump, filed in ticket 0061 under "The
     first frame of the split". Until the layout reports, the split
     paints the timeline at 320 px. On a 360 by 640 screen it settles at
     200 px.
   - Run the gates and `npx playwright test -c e2e/playwright.config.ts
     e2e/specs/planner-split.spec.ts --repeat-each=10` from `app/`.
2. Get PR #86's checks green and merge it into `epic/0047-rebuild`.
3. File the non-blocking review notes that the phase 3 reviewers left.
   They are comments on PRs #82 (0056), #83 (0067) and #84 (0066). Put
   each note in the ticket that owns that code.
4. Go on with "Run the next phases".

## Set up the machine

1. Install Git, Node 22, Python 3, the GitHub CLI (`gh`), Vale and
   Claude Code.
2. Log in to GitHub with an account that can push to
   `mzt-tang-athena/monkey-tasks`. Today that account is `mzt-tang`.

   ```sh
   gh auth login
   ```

3. Clone the repo and check out the integration branch.

   ```sh
   git clone https://github.com/mzt-tang-athena/monkey-tasks.git
   cd monkey-tasks
   git switch epic/0047-rebuild
   ```

4. Get the `contracts` submodule. The `.gitmodules` file uses an SSH URL.
   If SSH to GitHub does not work on this machine, map it to HTTPS:

   ```sh
   git -c url."https://github.com/".insteadOf="git@github.com:" submodule update --init
   ```

5. Set the commit email to the GitHub noreply address, in the repo and
   in the submodule:

   ```sh
   git config user.email 89080646+mzt-tang@users.noreply.github.com
   git -C contracts config user.email 89080646+mzt-tang@users.noreply.github.com
   ```

6. Install the dependencies, the Vale styles, the hooks and the
   Playwright browser:

   ```sh
   npm ci
   (cd app && npm ci && npx playwright install chromium)
   make ensure-styles hooks
   ```

7. Check the gates in `app/`. All must pass.

   ```sh
   npx tsc --noEmit
   npx eslint src scripts e2e --max-warnings 0
   npx vitest run
   npm run e2e
   ```

## Start the session

1. Start Claude Code in the repo root in bypass permissions mode. Press
   Shift+Tab until the mode line shows it.
   - In auto mode, the agents stop at prompts for push and merge
     commands, and a run can stall for hours.
   - Bypass mode runs every command with no prompt, so use it only for
     these runs.
2. Give the session this prompt:

   > Read docs/epic-0047-handover.md and continue epic 0047 from the
   > first step that is not done.

## Run the next phases

The phase scripts are in `.claude/workflows/`. Each run builds every
ticket in its own git worktree, then an independent agent reviews and
merges each PR. The scripts start each ticket from its pushed branch, so
a relaunch after a stop loses little.

1. Run phase 3b: `epic-0047-phase-3b`. It runs up to two fix rounds on
   PRs #81 and #80.
2. If the reviewers approve and merge both, run phase 4:
   `epic-0047-phase-4`. It builds 0058, then 0059 and 0062 in one lane,
   and 0060 and 0061 in a second lane.
3. Run phase 5: `epic-0047-phase-5`. It builds 0063.
4. Build a development client from the epic branch:

   ```sh
   gh workflow run android --ref epic/0047-rebuild -f dev=true
   ```

5. The owner installs the client and tests on the phone, with reduce
   motion on and then off.
6. Fix what the phone pass finds, in new tickets, through the same flow.
7. Merge PR #68 to `main` with a merge commit, not a squash. ADR 0035
   keeps each child commit on `main`.

If the account on the machine is not `mzt-tang`, pass it to each run as
the Workflow args: `{"ghUser": "<account>"}`.

## After each run

1. Read each agent's result. A reviewer that cannot merge reports
   approve true, merged false, and notes that start with "MERGE
   REFUSED". Merge that PR yourself with the command in the notes, after
   its checks pass.
2. Tick the merged tickets in the PR #68 checklist. Before
   `gh pr edit --body-file`, check that the file is not empty. An empty
   file blanks the PR body.
3. Remove the run's worktrees and their local branches. Then
   fast-forward the main checkout to `origin/epic/0047-rebuild`.
4. Put each non-blocking review note in the ticket that owns that code.
   If that ticket is in the next run, put the note in that ticket's
   notes in the script.

## Stop a run and start it again

1. Stop the run from `/workflows`.
2. In each worktree under `.claude/worktrees/`, commit what remains as a
   "WIP" commit and push it to the ticket's branch.
3. Remove the worktrees and their local branches.
4. Launch the same script again. A run started in a different session
   cannot resume from cache. Each agent continues from its pushed branch.

## Rules the runs follow

These decisions came from the owner in chat. They are not in an ADR.

| Rule | Detail |
|---|---|
| Child PRs | They squash into `epic/0047-rebuild` after an independent review and green CI. The agents merge them. |
| Final PR | PR #68 waits for the owner's phone pass, then merges with a merge commit. |
| Models | Sonnet builds and fixes the tickets with exact specs: 0055, 0056, 0057, 0063, 0066 and 0067. The 0057 fix in phase 3b is the exception: it runs on the session model. The session model also builds 0058 to 0062 and runs every review. |
| Commits | No `Co-Authored-By` line. The noreply email only. |
| Docs | ASD-STE100 plain English and no em dash. Vale runs at warning level in CI and in the pre-commit hook. |
| Bugs | Every bug fix starts with a test that reproduces it. Agents fix flaky tests and lint even when the cause is not theirs. |

## Known problems

- `git fetch` recurses into `contracts` over SSH and can hang. Add
  `--no-recurse-submodules`.
- In zsh, write `"${b}:refs/heads/${b}"` with braces. `$b:r` is a zsh
  modifier.
- No agent can run the Android app. Acceptance lines that need a phone
  stay unticked until the phone pass.
- CI still checks out `contracts` with the `CONTRACTS_TOKEN` secret,
  because of the SSH URL in `.gitmodules`. Both repos are public now, so
  an HTTPS URL would remove the secret.
- Tickets 0012 and 0013 sit in `tickets/doing/` from an older harness.
  Nobody works on them.
- Tickets 0064 (Maestro on Android) and 0065 (the list menu actions) come
  after this epic.

## Amendment, 2026-11-07: how the rest of the epic runs

The owner picked up the epic on the new machine and changed the plan.
The phase scripts in `.claude/workflows/` stay in the repo as a record.
Do not launch them.

- This guide merged as PR #86. Its e2e change passed 20 of 20 runs. The
  same run found two other flaky tests, filed as ticket 0070.
- Agents prove a change with the project skill in
  `.claude/skills/verify-monkey-tasks/` (ticket 0069, PR #87).
- Each open PR gets one fix agent, then one independent verifier, then
  a merge. Fix agents merge `epic/0047-rebuild` into their branch and
  never force-push.
- Ticket 0058 sets the motion API for 0059 to 0062. It gets a design
  comparison of two or three options before the build.
- The owner checks each motion ticket on the phone after it merges, not
  only once at the end.
- Step 3 of "Start here" is still open. The non-blocking notes on PRs
  #82, #83 and #84 are not yet in their tickets.
- The Models row in "Rules the runs follow" no longer holds. The
  owner's pstack model config picks the model for each agent.
