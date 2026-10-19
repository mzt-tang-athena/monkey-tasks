import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deedFrontmatter, validateNote } from "../src/index.js";

const vault = "/home/monkey/vault/main";

describe.skipIf(!existsSync(vault))("live vault sweep", () => {
  it("every real deed note validates against the deed schema", () => {
    const files = readdirSync(join(vault, "Deeds")).filter((f) => f.endsWith(".md"));
    expect(files.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const file of files) {
      const text = readFileSync(join(vault, "Deeds", file), "utf8");
      const result = validateNote(file, text, deedFrontmatter);
      if (result.errors) {
        failures.push(
          `${file}: ${result.errors.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
        );
      }
    }
    expect(failures).toEqual([]);
  });
});

