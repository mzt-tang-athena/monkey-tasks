export const meta = {
  name: 'epic-0047-phase-3b',
  description: 'Epic 0047 phase 3b: fix rounds for the blocked screen PRs, 0055 (#81) and 0057 (#80)',
  phases: [
    { title: '0055', detail: 'Lists screen: tab fade covers the selected tab' },
    { title: '0057', detail: 'capture dock: sheet outlives its tab' },
  ],
}

const REPO = 'mzt-tang-athena/monkey-tasks'
// The GitHub account whose gh token pushes and merges. Pass {ghUser} as the
// Workflow args when another account has push access on this machine.
const GH_USER = (typeof args === 'object' && args && args.ghUser) || 'mzt-tang'

const ENV = `ENVIRONMENT FACTS (read carefully):
- You run in your own git worktree (your cwd). Never edit files or run state-changing git commands in the main checkout: the repo root that holds .claude/worktrees/.
- Scratch files (screenshots, throwaway scripts, test vaults) go in build/scratch/ inside your worktree. It is gitignored.
- Start any server (expo export + python3 app/serve.py, Metro) with run_in_background, never in the foreground, then poll it with curl. A foreground server blocks you forever.
- Prefer absolute paths in commands.
- GitHub: use HTTPS through gh's credential helper with the ${GH_USER} account. Every gh command and every git fetch or push needs: export GH_TOKEN=$(gh auth token --user ${GH_USER})
  fetch:     git -c credential.helper= -c 'credential.helper=!gh auth git-credential' fetch --no-recurse-submodules https://github.com/${REPO}.git '+refs/heads/*:refs/remotes/origin/*'
  push:      git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push https://github.com/${REPO}.git "HEAD:refs/heads/<branch>"
  submodule: git -c url."https://github.com/".insteadOf="git@github.com:" -c credential.helper= -c 'credential.helper=!gh auth git-credential' submodule update --init
  (GH_TOKEN must be exported in the same shell for the credential helper to pick the right account. If the shell is zsh, write "\${b}:refs/..." with braces, because "$b:r" is a zsh modifier. Always fetch with --no-recurse-submodules, or git tries SSH for contracts and can hang.)
- Push your branch after every commit, so a cut-off run loses nothing. The owner's usage limit can stop this run at any time. So commit and push work in progress at least every 20 minutes, even when gates fail: a commit titled "WIP <ticket>: <what>" made with --no-verify is fine, because the PR is squash-merged. A WIP commit at the tip of origin/<branch> means a cut-off run: continue from it.
- The token can push changes under .github/workflows/. CI (ci.yml) runs on pull_request: docs (Vale), code (tsc, eslint --max-warnings 0, vitest, schema tests, Metro bundle) and e2e-web (Playwright).
- Commits use the GitHub noreply address. Before your first commit, check git config user.email prints 89080646+mzt-tang@users.noreply.github.com, and set it with git config if not. Before any commit inside contracts/, run: git -C contracts config user.email 89080646+mzt-tang@users.noreply.github.com
- Setup after you have your branch checked out: init the submodule as above, then npm ci at the repo root, then npm ci in app/. If Playwright's Chromium is missing, run npx playwright install chromium from app/ (behind a TLS-intercepting proxy, prefix NODE_OPTIONS=--use-system-ca).
- Commit with: git -c core.hooksPath=.githooks commit ...  (runs the repo's pre-commit hook). Never add a Co-Authored-By trailer.
- Gates, all must pass before any push of a PR. In app/: npx tsc --noEmit; npx eslint src scripts e2e --max-warnings 0; npx vitest run; E2E_PORT=<your port> npm run e2e (B2 is an expected failure marked test.fail until 0059). At the repo root: vale --minAlertLevel=warning --output=line <every .md you changed> prints nothing (run make ensure-styles first if .vale/styles/write-good is missing).
- A test that fails once and passes on a rerun is a flaky test. Find its cause and fix it, or report it with the failing output. Never retry it away.
- Ticket 0050 (#75) moved and renamed most files. Tickets written before it cite the old paths. The Outcome of tickets/done/0050-import-boundaries-and-shared-layers.md has a table that maps each old path to its new one. Later tickets moved more code, so grep for a name when a path is gone, and look each line number up again.
- Before you open a PR or push a fix, fetch and rebase your branch on origin/epic/0047-rebuild (other tickets merge into it while you work), resolve any conflict, re-run the gates, then push with --force-with-lease if the rebase rewrote pushed commits.
- Nobody here can run the Android app. Leave each acceptance line that needs a phone unticked, and say in the Outcome that the epic's phone pass covers it.
- Docs style: the ADR template voice (docs/adr/adr-template.md): short sentences, active voice, plain words, no em dash.
- Kill every server you start before you finish.`

const CONTEXT = (t) => `You work on ticket ${t.id} of epic 0047 in the monkey-tasks repo: an Expo SDK 58 / React Native 0.88 app in app/, with the notes schema package in the contracts submodule at contracts/. The epic plan is tickets/doing/0047-bulletproof-refactor-and-motion-rebuild.md, ADRs 0035 to 0042 record its decisions, and docs/epic-0047-handover.md describes how the epic runs. Read AGENTS.md, tickets/README.md, app/AGENTS.md, and your ticket in full before anything else: the ticket is the spec. Child PRs target the integration branch epic/0047-rebuild, never main (ADR 0035). Use port ${t.port} for any server you start, and E2E_PORT=${t.port} for the e2e suite.

${ENV}`

const IMPL_STEPS = (t) => `STEPS:
1. Fetch. If origin/${t.branch} exists, an earlier run of this ticket was cut off: git switch -c ${t.branch} origin/${t.branch}, read its commits (git log -p origin/epic/0047-rebuild..HEAD) and continue from where it stopped, skipping the steps it already did. Otherwise: git switch -c ${t.branch} origin/epic/0047-rebuild. Do the setup.
2. Unless it is already done: claim the ticket in its own commit (git mv ${t.file} into tickets/doing/, set assignee: claude-code, commit "Claim ${t.id}"), and push.
3. Implement the ticket. For each bug: write the test that reproduces it first and see it fail, then fix it. For any visible change, check it in the web preview like a picky user: take Playwright screenshots before and after and fix anything that looks off, even if it is not yours.
4. A trade-off decision the ticket does not settle gets an ADR or a dated amendment (AGENTS.md rule 2). Take the next free ADR number after a fetch, because parallel tickets also add ADRs.
5. Rebase on origin/epic/0047-rebuild, run every gate, push the branch. Open a PR with base epic/0047-rebuild (or find the open one for this branch): a plain title in the repo's style; a body with "## What changed" (what the diff does, as reference), "## How to test" (numbered steps a reviewer can follow), one line naming ticket ${t.id}, the gate results, and the final line: 🤖 Generated with [Claude Code](https://claude.com/claude-code)
6. Close the ticket in the same PR: tick the acceptance lines that hold, write ## Outcome (what landed, what is left and where it went), set pr:, git mv the ticket to tickets/done/, commit, push. Do not merge the PR.
7. Wait for CI: gh pr checks <n> --watch. If a check fails, fix it and push until all checks pass.
Return the PR number, the branch, a summary of what changed, the gate results, and any follow-ups.`

const REVIEW_STEPS = (t, pr, prior) => `You are the independent reviewer of PR #${pr} (branch ${t.branch}) for ticket ${t.id}. You did not write it. Do not trust its description.
${prior ? `This is a re-review. The previous review blocked on:\n${prior.map((b) => `- ${b.where}: ${b.issue}`).join('\n')}\nConfirm each one is fixed, then review the whole PR again.\n` : ''}
1. Fetch, then: git switch --detach origin/${t.branch}. Do the setup.
2. Verify every acceptance line in the ticket against the code and by running things yourself. Run every gate. Run any new or changed test 3 times to catch flakiness, and the e2e suite with --repeat-each=3. Check that each bug's test fails without its fix (revert the fix locally, run, restore).
3. Hunt for: correctness bugs; behaviour changes the ticket does not ask for (compare screens and flows against origin/epic/0047-rebuild in the web preview on port ${t.port + 1}); regressions in behaviour that earlier tickets verified on a device (read the ADRs the diff touches); convention breaks (ticket format and rules, ADR rules, docs style, the layout in ADR 0039).
4. Blocking means: a failing gate, an acceptance line not met and not explained in the Outcome, a bug, a visible regression, a convention break, or a PR that conflicts with epic/0047-rebuild (gh pr view ${pr} --json mergeable). Style nits do not block.
5. Do not push code. If nothing blocks: wait for CI with gh pr checks ${pr} --watch. When all checks pass, squash-merge with gh pr merge ${pr} --squash --delete-branch --subject "<the PR title> (#${pr})" --body "<two to four plain lines>". Never add a Co-Authored-By line. Report merged=true only if the merge succeeded. If a permission guard refuses gh pr merge, do not try to get around it: report approve=true and merged=false, and start notes with "MERGE REFUSED" and the exact merge command. The owner's session merges it.
6. If you block, also post your blocking issues and notes as one comment on the PR (gh pr comment ${pr} --body-file <file>; check the file is not empty first), so they survive this run.
Return approve, merged, the blocking issues with where they are, and notes (put every non-blocking finding in notes, with file and line).`

const FIX_STEPS = (t, pr, blocking, notes) => `The reviewer of PR #${pr} (branch ${t.branch}, ticket ${t.id}) found blocking issues:
${blocking.map((b) => `- ${b.where}: ${b.issue}`).join('\n')}
Reviewer notes: ${notes}

1. Fetch, then: git switch -c ${t.branch}-fix origin/${t.branch}. Push back to the remote branch ${t.branch}, never to a new remote branch. Do the setup.
2. Fix each blocking issue at its root. For a bug, write the reproducing test first and see it fail. Fix a non-blocking note too when the fix is small and tested. Update the ticket's Outcome if what landed changed.
3. Rebase on origin/epic/0047-rebuild, run every gate, push to the same remote branch, and wait for CI to pass (gh pr checks ${pr} --watch).
Return a short summary of each fix.`

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    pr: { type: 'number' },
    branch: { type: 'string' },
    summary: { type: 'string' },
    gates: { type: 'string' },
    followups: { type: 'string' },
  },
  required: ['pr', 'branch', 'summary', 'gates'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    approve: { type: 'boolean' },
    merged: { type: 'boolean' },
    blocking: {
      type: 'array',
      items: {
        type: 'object',
        properties: { where: { type: 'string' }, issue: { type: 'string' } },
        required: ['where', 'issue'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['approve', 'merged', 'blocking', 'notes'],
}

// Builds and fixes of tightly specified tickets run on Sonnet (t.buildModel).
// Every review runs on the session model.
const buildOpts = (t) => (t.buildModel ? { model: t.buildModel } : {})

// Fix and re-review until the reviewer approves, at most `rounds` times.
async function repair(t, pr, review, rounds) {
  const fixes = []
  for (let i = 1; i <= rounds && review && !review.approve; i++) {
    log(`${t.id}: review blocked on ${review.blocking.length} issue(s), fix round ${i}`)
    fixes.push(await agent(`${CONTEXT(t)}\n\n${FIX_STEPS(t, pr, review.blocking, review.notes)}`, {
      label: `fix ${t.id} (${i})`, phase: t.id, isolation: 'worktree', ...buildOpts(t),
    }))
    review = await agent(`${CONTEXT(t)}\n\n${REVIEW_STEPS(t, pr, review.blocking)}`, {
      label: `re-review ${t.id} (${i})`, phase: t.id, schema: REVIEW_SCHEMA, isolation: 'worktree',
    })
  }
  log(`${t.id}: ${review?.merged ? 'merged' : review?.approve ? 'approved, merge pending' : 'not merged'}`)
  return { review, fixes }
}

async function ship(t) {
  phase(t.id)
  const impl = await agent(`${CONTEXT(t)}\n\n${t.implExtra || ''}\n\n${IMPL_STEPS(t)}`, {
    label: `implement ${t.id}`, phase: t.id, schema: IMPL_SCHEMA, isolation: 'worktree', ...buildOpts(t),
  })
  if (!impl) return { ticket: t.id, status: 'implement failed' }
  log(`${t.id}: PR #${impl.pr} open`)
  const first = await agent(`${CONTEXT(t)}\n\n${REVIEW_STEPS(t, impl.pr, null)}`, {
    label: `review ${t.id}`, phase: t.id, schema: REVIEW_SCHEMA, isolation: 'worktree',
  })
  const { review, fixes } = await repair(t, impl.pr, first, 1)
  return { ticket: t.id, pr: impl.pr, impl, review, fixes, merged: !!review?.merged, approved: !!review?.approve }
}

// Both PRs passed one fix round and failed the re-review. Each re-review is
// a comment on its PR (posted 2026-11-07), with the full blocking text and
// the reviewer's notes. The fix agent reads it there.
const T55 = {
  id: '0055', file: 'tickets/doing/0055-lists-screen-leaves-the-route.md', branch: 'feat/0055-lists-screen-leaves-the-route', port: 8200, buildModel: 'sonnet', pr: 81,
  blocking: [{
    where: 'app/src/components/ui/tab-strip.tsx:17-19 (fadeSteps, fadeStepWidth) and :73 (scrollTo x - spacing.m)',
    issue: 'The start fade (30 px) paints over the first ~6 px of the selected tab after the strip scrolls it into view, because the strip scrolls the tab to x - spacing.m and the label starts 12 px further in. Repro at 412x915: tap Errands or Health. Scroll the selected tab clear of the fade (or keep the fade inside the tab padding), and add a Playwright check that the start fade box does not overlap the selected tab text after a tab change. Full text: the latest review comment on PR #81.',
  }, {
    where: 'the ADR this PR adds as 0041',
    issue: 'ADRs 0041 (week columns, from 0056) and 0042 (month-end rule, from 0066) merged into the epic while this PR was open, so its ADR number is taken. Renumber it to the next free number at the rebase, and fix every reference to it.',
  }],
}
const T57 = {
  id: '0057', file: 'tickets/doing/0057-capture-dock-and-editor-split.md', branch: 'feat/0057-capture-dock-and-editor-split', port: 8220, pr: 80,
  // The Sonnet build missed this overlay design problem twice, so the fix
  // runs on the session model.
  blocking: [{
    where: 'app/src/features/capture/components/capture-dock.tsx:39-50 with app/src/components/bottom-bar/bottom-bar.tsx:94,100',
    issue: 'The capture sheet draws through the root OverlayHost, so it floats above every screen and outlives its tab, and the nav tabs no longer close it (the base called closeNow() before router.navigate). On web the screen under it keeps keyboard focus. Repro 1: open Lists, press Add, type, Tab to a row and press Enter: the editor opens under the Lists sheet and scrim. Repro 2: open the sheet, Shift+Tab to Planner, Enter: the Lists sheet stays over the Planner. Close the sheet when its tab loses focus and draw it only while focused (as the toast now does); consider marking the hidden screen inert on web in overlay-host.tsx:66. Add a component test and an e2e test. Full text: the latest review comment on PR #80.',
  }],
}

const NOTES = (t) => `See the latest review comment on PR #${t.pr} for the full text and the reviewer's non-blocking notes.`

const results = await parallel([T55, T57].map((t) => async () => {
  phase(t.id)
  const { review, fixes } = await repair(t, t.pr, { approve: false, blocking: t.blocking, notes: NOTES(t) }, 2)
  return { ticket: t.id, pr: t.pr, review, fixes, merged: !!review?.merged, approved: !!review?.approve }
}))

return { results: results.filter(Boolean) }
