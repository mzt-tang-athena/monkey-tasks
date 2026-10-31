import type { VaultSeed } from "../adapters/memory";
import { sampleNotes } from "./index";

/**
 * The sample vaults the web preview and Playwright run on (ticket 0051).
 * The notes sit beside this file as plain `.md` files, one folder per
 * seed. `npm run sample:build` turns them into `index.ts`.
 */

/** The day the sample notes are written against. */
export const SAMPLE_DAY = "2026-10-26";

/** What the preview loads when the page asks for no seed. */
export const PREVIEW_SEEDS = ["default", "repair"];

/** The block between the opening and closing `---`. */
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

/** A date that opens a property value or a list item. */
const DATE_VALUE =
  /^(\s*(?:-\s+|[^\s:#][^:\n]*:[ \t]+))(\d{4})-(\d{2})-(\d{2})(?=$|[T\s])/gm;

/** Whole days from one `YYYY-MM-DD` to another. */
export function daysBetween(from: string, to: string): number {
  const utc = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/**
 * Move every date value in the frontmatter by `days`. A datetime keeps
 * its time. The body and every other value stay as they are.
 */
export function shiftDates(text: string, days: number): string {
  if (days === 0) {
    return text;
  }
  return text.replace(FRONTMATTER, (block) =>
    block.replace(DATE_VALUE, (_match, head: string, year, month, day) => {
      const moved = new Date(
        Date.UTC(Number(year), Number(month) - 1, Number(day) + days),
      );
      return `${head}${moved.toISOString().slice(0, 10)}`;
    }),
  );
}

/**
 * The files of the named seeds, in order, with every date moved so the
 * sample day lands on `today`. Every group in the list then stays full.
 */
export function sampleSeed(names: string[], today: string): VaultSeed {
  const days = daysBetween(SAMPLE_DAY, today);
  const files: VaultSeed = {};
  for (const name of names) {
    const notes = sampleNotes[name];
    if (notes == null) {
      throw new Error(
        `no sample vault "${name}": pick from ${Object.keys(sampleNotes).join(", ")}`,
      );
    }
    for (const [path, text] of Object.entries(notes)) {
      files[path] = shiftDates(text, days);
    }
  }
  return files;
}
