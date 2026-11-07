import path from "node:path";
import base from "../../../../app/e2e/playwright.config";

const target = process.env.VERIFY_TARGET!;
const isFile = target.endsWith(".ts");

export default {
  ...base,
  webServer: undefined,
  testDir: isFile ? path.dirname(target) : target,
  testMatch: isFile ? path.basename(target) : "**/*.journey.ts",
  outputDir: path.join(process.env.VERIFY_OUT!, "results"),
  reporter: [["list"], ["html", { open: "never", outputFolder: path.join(process.env.VERIFY_OUT!, "report") }]],
  use: { ...base.use, screenshot: "on", trace: "on" },
};
