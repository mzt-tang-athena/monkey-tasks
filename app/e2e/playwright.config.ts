import { defineConfig } from "@playwright/test";

// The end-to-end suite drives the exported web build (ADR 0038). The
// browser preview serves the in-memory sample set, so no vault is
// needed. Ticket 0049 holds the scenarios.
// E2E_PORT lets parallel worktrees each serve their own build.
const port = Number(process.env.E2E_PORT) || 8094;

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
  // Both projects run every spec, so each end state also holds with
  // reduced motion.
  projects: [
    { name: "motion" },
    { name: "reduced-motion", use: { reducedMotion: "reduce" } },
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
