import { describe, expect, it } from "vitest";
import { THEMES, type Palette } from "./palettes";

/** WCAG AA for text. */
const MIN = 4.5;

/**
 * Every text pair the screens draw: foreground over ground. The pairs
 * name real style combinations in `src/components` and `src/features`,
 * such as `label` over `pressed` in a menu and `quietText` over
 * `quiet` in a button.
 *
 * Left out on purpose: `inkFaint` is the disabled and placeholder step,
 * and WCAG exempts disabled text; `hairline` is decoration, not text.
 */
const PAIRS: { foreground: keyof Palette; background: keyof Palette }[] = [
  { foreground: "ink", background: "paper" },
  { foreground: "ink", background: "surface" },
  { foreground: "ink", background: "pressed" },
  { foreground: "ink", background: "accentSoft" },
  { foreground: "inkMuted", background: "paper" },
  { foreground: "inkMuted", background: "surface" },
  { foreground: "inkMuted", background: "pressed" },
  { foreground: "inkMuted", background: "accentSoft" },
  { foreground: "accent", background: "paper" },
  { foreground: "accent", background: "surface" },
  { foreground: "accent", background: "pressed" },
  { foreground: "accent", background: "accentSoft" },
  { foreground: "danger", background: "paper" },
  { foreground: "danger", background: "surface" },
  { foreground: "danger", background: "dangerSoft" },
  { foreground: "onAccent", background: "accent" },
  { foreground: "onAccent", background: "accentDeep" },
];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function ratio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const names = Object.keys(THEMES) as (keyof typeof THEMES)[];

describe("theme contrast", () => {
  it("gives every palette the same keys", () => {
    const keys = Object.keys(THEMES.budget).sort();
    for (const name of names) {
      expect(Object.keys(THEMES[name]).sort(), name).toEqual(keys);
    }
  });

  for (const name of names) {
    it(`${name} holds every text pair at ${MIN} to 1`, () => {
      const palette = THEMES[name];
      const failures = PAIRS.flatMap(({ foreground, background }) => {
        const got = ratio(palette[foreground], palette[background]);
        return got < MIN
          ? [`${foreground} on ${background}: ${got.toFixed(2)}`]
          : [];
      });
      expect(failures).toEqual([]);
    });
  }
});
