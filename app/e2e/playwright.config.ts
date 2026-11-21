import { readdirSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "@playwright/test";
import { markProblems, motionFree } from "./motion";

// The end-to-end suite drives the exported web build (ADR 0038). The
// browser preview runs on a memory vault seeded from the sample notes,
// so no folder is needed (ADR 0037). Ticket 0049 holds the scenarios.
// E2E_PORT lets parallel worktrees each serve their own build.
const port = Number(process.env.E2E_PORT) || 8094;

// A spec with no mark would run twice with nothing to say for it, so
// the suite stops before it starts.
const problems = markProblems(
  readdirSync(path.join(__dirname, "specs")).filter((file) =>
    file.endsWith(".spec.ts"),
  ),
);
if (problems.length > 0) {
  throw new Error(`e2e/motion.ts: ${problems.join("; ")}`);
}

export default defineConfig({
  testDir: "./specs",
  // Without this, traces land beside package.json, not in e2e/.
  outputDir: "./test-results",
  forbidOnly: !!process.env.CI,
  // A flaky test is a bug to fix, so nothing retries.
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
    viewport: { width: 412, height: 915 },
    // CI runs in UTC, and the sample dates follow the local day. The
    // zone and the locale keep every run on the same day.
    timezoneId: "Pacific/Auckland",
    locale: "en-NZ",
    trace: "retain-on-failure",
  },
  // A spec that checks motion runs in both projects, so its end state
  // also holds with reduced motion. The rest run once: `motion.ts` names
  // them and gives the reason.
  projects: [
    { name: "motion" },
    {
      name: "reduced-motion",
      use: { reducedMotion: "reduce" },
      testIgnore: motionFree,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // serve.py falls back to index.html, so /planner survives a
        // reload.
        command: `python3 serve.py dist ${port}`,
        cwd: "..",
        url: `http://localhost:${port}`,
        // A server already on the port may serve another checkout's
        // build, so a busy port fails the run instead.
        reuseExistingServer: false,
      },
});
