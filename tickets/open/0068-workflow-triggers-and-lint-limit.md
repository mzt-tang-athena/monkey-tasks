---
id: 0068
title: Workflow triggers and the CI lint limit
created: 2026-10-27
priority: high
assignee:
pr:
depends: []
---

## Spec

Ticket 0048 steps 8 and 10 change the two workflow files. An agent
cannot push them: GitHub refuses a workflow change from a token without
the `workflow` scope, and the agent tokens have `repo` only. The owner
pushes this change over SSH, or with a token that has the `workflow`
scope. Push it to a branch and open a PR into `epic/0047-rebuild`.

What it fixes:

- `ci.yml` runs on `[push, pull_request]`, so a commit on a PR branch
  runs CI twice.
- `android.yml` builds a release APK on every push to main that
  touches `app/`. A build takes 19 to 45 minutes.
- CI runs ESLint without a warning limit. The pre-commit hook already
  fails on a warning (0048). A warning that CI ignores goes unread
  (ADR 0026).

### Work

Apply this diff from the repo root (`git apply`):

```diff
diff --git a/.github/workflows/android.yml b/.github/workflows/android.yml
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
+        run: npx eslint src scripts --max-warnings 0
         working-directory: app
       - name: Test app
         run: npx vitest run
```

Then add one sentence to the README section "Install it on a phone",
after "the runner already has the Android SDK.": "It runs only when you
start it."

## Acceptance

- [ ] A commit on a PR branch starts one CI run, not two.
- [ ] A push to main no longer starts `android.yml`, and the manual run still builds the APK.
- [ ] The CI lint step fails on an ESLint warning.

## Outcome
(filled in before moving to done/)
