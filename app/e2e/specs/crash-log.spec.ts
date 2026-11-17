import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { undated } from "../data";
import { press, row } from "../locators";

/**
 * Ticket 0081: the phone keeps a crash report the operator can read,
 * copy and share. The report is app storage, never a vault note, and
 * nothing leaves the device unless the operator sends it.
 */

type CrashWindow = {
  __crash?: { report(message: string): void; read(): string; reset(): void };
  __shared?: string;
};

async function openSettings(page: Page) {
  await press(page, page.getByRole("button", { name: "list menu" }));
  await press(page, page.getByRole("menuitem", { name: "Settings" }));
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

test.describe("crash log", () => {
  test("reads, copies and shares a report without touching the vault", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async (data: { text?: string }) => {
          (globalThis as CrashWindow).__shared = data.text;
        },
      });
    });
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();
    const vault = await page.evaluate(() => globalThis.__vault?.files() ?? {});

    await page.evaluate(() =>
      (globalThis as CrashWindow).__crash?.report("e2e boom"),
    );
    const written = await page.evaluate(
      () => (globalThis as CrashWindow).__crash?.read() ?? "",
    );
    expect(written).toContain("message: e2e boom");
    expect(written).toContain("app=");
    expect(written).toContain("platform=web");

    await openSettings(page);
    await expect(page.getByTestId("crash-log-entry")).toContainText(
      "message: e2e boom",
    );

    await press(page, page.getByRole("button", { name: "Copy crash log" }));
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      "message: e2e boom",
    );

    await press(page, page.getByRole("button", { name: "Share crash log" }));
    await expect
      .poll(() => page.evaluate(() => (globalThis as CrashWindow).__shared ?? ""))
      .toContain("message: e2e boom");

    // App storage only: the vault holds exactly what it held before.
    expect(await page.evaluate(() => globalThis.__vault?.files() ?? {})).toEqual(
      vault,
    );

    // The log survives a reload, so a close after a crash keeps it.
    await page.reload();
    await expect(page.getByTestId("crash-log-entry")).toContainText(
      "message: e2e boom",
    );
  });

  test("says so when nothing was recorded", async ({ page }) => {
    await page.goto("/");
    await expect(row(page, undated.second)).toBeVisible();

    await openSettings(page);

    await expect(page.getByText("No crashes recorded.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Copy crash log" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});
