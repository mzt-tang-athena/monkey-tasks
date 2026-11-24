import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADAPTIVE, ASSETS } from "./build.js";
import { DRAWINGS, PALETTE, TILE, markReach } from "./monkey.js";

const app = join(import.meta.dirname, "..", "..");
const config = JSON.parse(readFileSync(join(app, "app.json"), "utf8"));

describe("the app icon", () => {
  it("paints the colour app.json gives the adaptive icon", () => {
    expect(config.expo.android.adaptiveIcon.backgroundColor.toUpperCase()).toBe(PALETTE.bg);
  });

  it("gives the splash the same tile colour", () => {
    const splash = config.expo.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
    );

    expect(splash?.[1]?.backgroundColor?.toUpperCase()).toBe(PALETTE.bg);
  });

  it("keeps the drawing inside the 66 of 108 safe circle", () => {
    expect(markReach()).toBeLessThan(ADAPTIVE.safe / 2);
  });

  it("ships every asset at the size the list names", () => {
    for (const asset of ASSETS) {
      const png = readFileSync(join(app, "assets", asset.file));
      expect([png.readUInt32BE(16), png.readUInt32BE(20)], asset.file).toEqual([
        asset.size,
        asset.size,
      ]);
    }
  });

  it("keeps the square tile full bleed and rounds only the favicon's", () => {
    expect(DRAWINGS["tile-square"]).not.toContain("clipPath");
    expect(DRAWINGS["tile-square"]).toContain(
      `<rect width="${TILE}" height="${TILE}" fill="${PALETTE.bg}"/>`,
    );
    expect(DRAWINGS["tile-round"]).toContain("clipPath");
  });
});
