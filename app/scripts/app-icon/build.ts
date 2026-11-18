/**
 * The app icon, as data. Each committed asset names the SVG source it
 * comes from and the pixel size it ships at. `cli.ts` rasterizes the
 * list, so the PNGs can always be rebuilt from the sources.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const here = import.meta.dirname;

export type Asset = {
  file: string;
  source: string;
  size: number;
};

export const ASSETS: readonly Asset[] = [
  { file: "icon.png", source: "tile-square.svg", size: 1024 },
  { file: "android-icon-foreground.png", source: "tick-adaptive.svg", size: 1024 },
  { file: "android-icon-background.png", source: "background.svg", size: 1024 },
  { file: "android-icon-monochrome.png", source: "tick-adaptive.svg", size: 1024 },
  { file: "splash-icon.png", source: "tile-round.svg", size: 1024 },
  { file: "favicon.png", source: "tile-round.svg", size: 48 },
];

/**
 * The adaptive icon's safe zone. Android draws the middle 72 of the
 * layer's 108 units and reserves the rest for the launcher's mask. A
 * Pixel's circle mask, the tightest common one, keeps 66.
 */
export const ADAPTIVE = {
  layer: 108,
  visible: 72,
  safe: 66,
} as const;

/** Read one committed source SVG as text. */
export function readSource(source: string): string {
  return readFileSync(join(here, "source", source), "utf8");
}

/**
 * Give the source an explicit pixel size. The sources carry only a
 * viewBox, so the same drawing scales to every asset.
 */
export function atSize(svg: string, size: number): string {
  if (!svg.includes("<svg ")) throw new Error("source is not an <svg>");
  return svg.replace("<svg ", `<svg width="${size}" height="${size}" `);
}

/** The fill colour a source paints its background with. */
export function backgroundOf(svg: string): string {
  const match = /<rect[^>]*fill="(#[0-9A-Fa-f]{6})"/.exec(svg);
  if (!match) throw new Error("source has no filled background rect");
  return match[1].toUpperCase();
}
