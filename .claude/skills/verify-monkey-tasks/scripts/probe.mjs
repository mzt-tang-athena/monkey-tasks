// Doctor's usability probe. Run from app/ so @playwright/test resolves.
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.cwd()}/`)("@playwright/test");

const url = `http://localhost:${process.env.PORT}/`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  await page.goto(url);
  await page.locator('[data-testid^="task-row:"]').first().waitFor({ timeout: 15000 });
  const hooks = await page.evaluate(() => typeof globalThis.__vault?.read === "function");
  if (!hooks) throw new Error("globalThis.__vault is missing: the build lacks EXPO_PUBLIC_VAULT_TEST_HOOKS=1");
} catch (error) {
  console.error(`probe ${url}: ${error.message.split("\n")[0]}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
