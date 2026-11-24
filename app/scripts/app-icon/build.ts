/**
 * The app icon, as data. Each committed asset names the drawing it comes
 * from and the pixel size it ships at. `cli.ts` rasterizes the list, so
 * the PNGs can always be rebuilt from `monkey.ts`.
 */

import type { Drawing } from "./monkey.js";

export type Asset = {
  file: string;
  source: Drawing;
  size: number;
};

export const ASSETS: readonly Asset[] = [
  { file: "icon.png", source: "tile-square", size: 1024 },
  { file: "android-icon-foreground.png", source: "adaptive-foreground", size: 1024 },
  { file: "android-icon-background.png", source: "adaptive-background", size: 1024 },
  { file: "android-icon-monochrome.png", source: "monochrome", size: 1024 },
  { file: "splash-icon.png", source: "adaptive-foreground", size: 1024 },
  { file: "favicon.png", source: "tile-round", size: 48 },
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

/**
 * Give the drawing an explicit pixel size. The sources carry only a
 * viewBox, so the same drawing scales to every asset.
 */
export function atSize(svg: string, size: number): string {
  if (!svg.includes("<svg ")) throw new Error("source is not an <svg>");
  return svg.replace("<svg ", `<svg width="${size}" height="${size}" `);
}
