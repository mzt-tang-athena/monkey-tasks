import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFS, buildGlyphTable } from "./build.js";

const app = join(import.meta.dirname, "..", "..");

/**
 * The table is the artifact, and the package is its source. A glyph
 * added to the map without a run, or a package bump that moves a
 * drawing, fails here instead of shipping a stale shape.
 */
describe("glyph table", () => {
  it("matches the package it is generated from", () => {
    const committed = readFileSync(
      join(app, "src", "components", "ui", "glyphs.ts"),
      "utf8",
    );

    expect(buildGlyphTable(join(app, DEFS)), "run npm run icons:build").toBe(
      committed,
    );
  });
});
