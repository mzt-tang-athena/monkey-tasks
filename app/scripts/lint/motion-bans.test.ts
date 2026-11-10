import fs from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// The fixture marks each line that must fail with the ADR its rule
// names. Every other line must pass. Linting it as a feature file
// proves each motion ban fires, and linting it as a file on the
// allowlist proves the bans lift there while the margin rule (ADR
// 0012) and the file system rule (ADR 0037) still fire.
const app = path.resolve(import.meta.dirname, "../..");
const fixture = fs.readFileSync(path.join(import.meta.dirname, "motion-bans.fixture.txt"), "utf8");

const rules = new Set(["no-restricted-imports", "no-restricted-syntax"]);

/** How each rule's message cites its ADR. */
const cites: Record<string, string> = {
  "ADR 0012": "docs/adr/0012",
  "ADR 0037": "ADR 0037",
  "ADR 0046": "ADR 0046",
};

/** The ADR each failing line names, by line number. */
function expected(allowlisted: boolean): Map<number, string> {
  const lines = new Map<number, string>();
  fixture.split("\n").forEach((line, index) => {
    const adr = /\/\/ (ADR \d{4})$/.exec(line)?.[1];
    if (adr !== undefined && (!allowlisted || adr !== "ADR 0046")) {
      lines.set(index + 1, adr);
    }
  });
  return lines;
}

async function lint(filePath: string): Promise<Map<number, string[]>> {
  const eslint = new ESLint({ cwd: app });
  const [result] = await eslint.lintText(fixture, { filePath: path.join(app, filePath) });
  const errors = new Map<number, string[]>();
  for (const message of result.messages) {
    if (message.ruleId != null && rules.has(message.ruleId)) {
      errors.set(message.line, [...(errors.get(message.line) ?? []), message.message]);
    }
  }
  return errors;
}

function check(errors: Map<number, string[]>, want: Map<number, string>) {
  expect([...errors.keys()].sort((a, b) => a - b)).toEqual([...want.keys()]);
  for (const [line, adr] of want) {
    const messages = errors.get(line) ?? [];
    expect(messages, `line ${line}`).toHaveLength(1);
    expect(messages[0], `line ${line}`).toContain(cites[adr]);
  }
}

describe("motion lint bans", () => {
  it("fails each banned line once in a feature", async () => {
    check(await lint("src/features/lint-check/fixture.tsx"), expected(false));
  }, 60_000);

  it("lifts the motion bans on the allowlist and keeps the old rules", async () => {
    check(await lint("src/features/lists/lists-screen.tsx"), expected(true));
  }, 60_000);
});
