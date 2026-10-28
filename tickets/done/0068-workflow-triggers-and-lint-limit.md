---
id: 0068
title: Workflow triggers and the CI lint limit
created: 2026-10-27
priority: high
assignee: claude-code
pr: 74
depends: []
---

## Spec

Ticket 0048 steps 8 and 10 change the two workflow files, and ticket
0049 adds the Playwright job. An agent cannot push them: GitHub
refuses a workflow change from a token without the `workflow` scope,
and the agent tokens have `repo` only. The owner pushes this change
over SSH, or with a token that has the `workflow` scope. Push it to a
branch and open a PR into `epic/0047-rebuild`.

What it fixes:

- `ci.yml` runs on `[push, pull_request]`, so a commit on a PR branch
  runs CI twice.
- `android.yml` builds a release APK on every push to main that
  touches `app/`. A build takes 19 to 45 minutes.
- CI runs ESLint without a warning limit. The pre-commit hook already
  fails on a warning (0048). A warning that CI ignores goes unread
  (ADR 0026).
- CI lints `src` and `scripts` but not `e2e`, the Playwright suite from
  0049.
- CI runs no end-to-end test. Ticket 0049 added the suite in `app/e2e`.
  The `e2e-web` job exports the web build and runs it, on both the
  motion and the reduced motion project. It keeps the browser in a
  cache and uploads the HTML report, with traces, when a test fails.

### Work

Apply this diff from the repo root (`git apply`):

```diff
diff --git a/.github/workflows/android.yml b/.github/workflows/android.yml
index 887013a..25c40da 100644
--- a/.github/workflows/android.yml
+++ b/.github/workflows/android.yml
@@ -3,6 +3,9 @@ name: android
 # Builds a sideloadable APK on a GitHub runner, which already has the
 # Android SDK and NDK. The release build signs with the debug key that
 # prebuild generates, which is enough to install by hand on a phone.
+#
+# It runs only on demand. A build takes 19 to 45 minutes, and a push to
+# main rarely needs a new APK.
 
 on:
   workflow_dispatch:
@@ -11,11 +14,6 @@ on:
         description: Build a development client APK instead of release
         type: boolean
         default: false
-  push:
-    branches: [main]
-    paths:
-      - "app/**"
-      - ".github/workflows/android.yml"
 
 jobs:
   apk:
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 342e5bf..2548091 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,5 +1,11 @@
 name: ci
-on: [push, pull_request]
+# A pull request runs once, on its pull_request event. Pushes run only
+# on main and on integration branches, so each squash merge into an
+# epic branch still gets a run.
+on:
+  push:
+    branches: [main, "epic/**"]
+  pull_request: {}
 
 jobs:
   docs:
@@ -66,7 +72,7 @@ jobs:
         run: npx tsc --noEmit
         working-directory: app
       - name: Lint app
-        run: npx eslint src scripts
+        run: npx eslint src scripts e2e --max-warnings 0
         working-directory: app
       - name: Test app
         run: npx vitest run
@@ -78,3 +84,58 @@ jobs:
       - name: Bundle app with Metro
         run: npx expo export --platform android --output-dir /tmp/bundle
         working-directory: app
+
+  # Playwright drives the exported web build through the sample set
+  # (ADR 0038, ticket 0049). The steps up to the app install match the
+  # code job.
+  e2e-web:
+    runs-on: ubuntu-latest
+    timeout-minutes: 10
+    steps:
+      - uses: actions/checkout@v4
+        with:
+          submodules: false
+      - name: Check out the contracts submodule
+        env:
+          CONTRACTS_TOKEN: ${{ secrets.CONTRACTS_TOKEN }}
+        run: |
+          if [ -n "$CONTRACTS_TOKEN" ]; then
+            git config --global url."https://x-access-token:${CONTRACTS_TOKEN}@github.com/".insteadOf "git@github.com:"
+          fi
+          if ! git submodule update --init --recursive; then
+            echo "::error::Cannot check out the contracts submodule. Add a CONTRACTS_TOKEN secret with read access to mzt-tang-athena/contracts, or make that repository public."
+            exit 1
+          fi
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 22
+          cache: npm
+          cache-dependency-path: |
+            package-lock.json
+            app/package-lock.json
+      - name: Install root dependencies
+        run: npm ci
+      - name: Install app dependencies
+        run: npm ci
+        working-directory: app
+      # The key follows the lock file, so a Playwright bump fetches the
+      # browser build that matches it.
+      - uses: actions/cache@v4
+        with:
+          path: ~/.cache/ms-playwright
+          key: playwright-${{ runner.os }}-${{ hashFiles('app/package-lock.json') }}
+      - name: Install Chromium
+        run: npx playwright install --with-deps chromium
+        working-directory: app
+      - name: Export the web build
+        run: npx expo export --platform web --output-dir dist
+        working-directory: app
+      - name: Run Playwright
+        run: npx playwright test -c e2e/playwright.config.ts
+        working-directory: app
+      - if: failure()
+        uses: actions/upload-artifact@v4
+        with:
+          name: playwright-report
+          path: app/e2e/playwright-report
+          retention-days: 7
```

Then add one sentence to the README section "Install it on a phone",
after "the runner already has the Android SDK.": "It runs only when you
start it."

## Acceptance

- [x] A commit on a PR branch starts one CI run, not two.
- [x] A push to main no longer starts `android.yml`, and the manual run still builds the APK.
- [x] The CI lint step fails on an ESLint warning.
- [x] The CI lint step covers `app/e2e`.
- [x] The `e2e-web` job passes in CI in under 5 minutes, and a second run hits the browser cache.
- [x] A failing CI run uploads the HTML report with traces.

## Outcome

Landed in PR #74, after the owner gave the `mzt-tang` token the
`workflow` scope on 2026-10-28. The diff above applied cleanly, and the
README sentence went in as written.

Evidence, all on GitHub Actions:

| Check | Result |
|---|---|
| Runs per PR commit | One `ci` run per push to the PR branch, event `pull_request` (run 40604627940). |
| `e2e-web` | 36 passed. The job took 2 minutes 5 seconds on a cold cache. |
| Browser cache | A rerun of `e2e-web` logged a cache hit for the `playwright-Linux-...` key and took 2 minutes 21 seconds. |
| Lint limit and e2e failure | A scratch push to `epic/scratch-0068` held one unused variable and one failing test. `Lint app` failed, `Run Playwright` failed with 2 failed and 36 passed, and the job uploaded `playwright-report` (692 KB). The scratch branch is deleted. |
| Manual APK build | `gh workflow run android --ref feat/0068-workflow-triggers` built `monkey-tasks-apk` (36.7 MB) in 24 minutes (run 40605203057). |

A push to main no longer matches any trigger in `android.yml`, because
the file now lists `workflow_dispatch` only.

The evidence runs used commit 5efbc63, before the rebase onto #73,
which changed `playwright.config.ts`. The CI run on the final head also
passed 36 tests with a cache hit.

The `code`, `e2e-web` and `android` jobs still need the
`CONTRACTS_TOKEN` secret, although `contracts` has been public since
2026-10-27. `.gitmodules` uses the SSH URL, the runner has no SSH key,
and only the secret's `insteadOf` line turns the URL into HTTPS. A
switch of `.gitmodules` to the HTTPS URL would let a later change drop
the secret, and the "or make that repository public" error text with
it.
