import fs from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Ticket 0083: the palette reaches a component through the provider.
// A direct import of the retired module constant fails in every source
// folder that renders.
const app = path.resolve(import.meta.dirname, "../..");
const fixture = fs.readFileSync(
  path.join(import.meta.dirname, "theme-bans.fixture.txt"),
  "utf8",
);
const banned = [1, 2];

async function lint(filePath: string): Promise<number[]> {
  const eslint = new ESLint({ cwd: app });
  const [result] = await eslint.lintText(fixture, {
    filePath: path.join(app, filePath),
  });
  return result.messages
    .filter(
      (message) =>
        message.ruleId === "no-restricted-imports" &&
        message.message.includes("ADR 20261111"),
    )
    .map((message) => message.line);
}

describe("theme lint ban", () => {
  for (const folder of ["features", "components"]) {
    it(`fails a direct palette import in ${folder}`, async () => {
      expect(
        await lint(`src/${folder}/lint-check/fixture.tsx`),
      ).toEqual(banned);
    }, 60_000);
  }
});
