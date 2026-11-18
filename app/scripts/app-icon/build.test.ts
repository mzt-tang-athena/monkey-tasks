import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ADAPTIVE, ASSETS, backgroundOf, readSource } from "./build.js";

const app = join(import.meta.dirname, "..", "..");

function adaptiveTick() {
  const svg = readSource("tick-adaptive.svg");
  const points = /points="([^"]+)"/.exec(svg)?.[1];
  const stroke = Number(/stroke-width="(\d+)"/.exec(svg)?.[1]);
  const scale = Number(/scale\(([\d.]+)\)/.exec(svg)?.[1]);
  if (!points || !stroke || !scale) throw new Error("tick source changed shape");
  return {
    points: points.split(" ").map((pair) => pair.split(",").map(Number)),
    stroke: stroke * scale,
    scale,
  };
}

describe("app icon sources", () => {
  it("paints the colour app.json gives the adaptive icon", () => {
    const config = JSON.parse(readFileSync(join(app, "app.json"), "utf8"));

    expect(backgroundOf(readSource("background.svg"))).toBe(
      config.expo.android.adaptiveIcon.backgroundColor.toUpperCase(),
    );
  });

  it("keeps the adaptive tick inside the 66 of 108 safe circle", () => {
    const { points, stroke, scale } = adaptiveTick();
    const safe = ((ADAPTIVE.safe / ADAPTIVE.layer) * 512) / 2;
    const reach = Math.max(
      ...points.map(([x, y]) =>
        Math.hypot(
          256 + (x - 256) * scale - 256,
          256 + (y - 256) * scale - 256,
        ) + stroke / 2,
      ),
    );

    expect(reach).toBeLessThan(safe);
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
});
