import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkVault } from "../vault-check/check.js";
import { SAMPLE_DIR, buildSampleIndex } from "./build.js";

const sampleDir = join(import.meta.dirname, "..", "..", SAMPLE_DIR);

describe("the sample notes", () => {
  it("match the generated index; run `npm run sample:build` after an edit", () => {
    const index = readFileSync(join(sampleDir, "index.ts"), "utf8");

    expect(index).toBe(buildSampleIndex(sampleDir));
  });

  it("pass vault:check in the default seed", () => {
    expect(checkVault(join(sampleDir, "default"))).toEqual({
      notes: 25,
      findings: [],
    });
  });

  it("break in the repair seed the way the repair block shows", () => {
    expect(checkVault(join(sampleDir, "repair"))).toEqual({
      notes: 2,
      findings: [
        {
          file: "Tasks/Broken note.md",
          line: 2,
          kind: "invalid",
          reason: "created: Invalid input: expected string, received undefined",
        },
        {
          file: "Tasks/Lists/Garden.md",
          line: 2,
          kind: "invalid",
          reason: 'kind: Invalid input: expected "[[lists]]"',
        },
        {
          file: "Tasks/Lists/Garden.md",
          line: 2,
          kind: "invalid",
          reason: "created: Invalid input: expected string, received undefined",
        },
      ],
    });
  });
});
