import type { ReferenceNote } from "@/types/reference";

/**
 * The picker's search over the References folder. One query word
 * matches a note by its file name or by any ingredient in its
 * frontmatter, whole or as a run of letters in order (ticket 0091), so
 * "egg" finds `chinese-steamed-eggs` and "oats" finds a note that lists
 * oats among its ingredients. A name beats an ingredient, and a whole
 * word beats letters in order, so the closest note reads first.
 */

const NAME_WHOLE = 4;
const NAME_RUN = 3;
const INGREDIENT_WHOLE = 2;
const INGREDIENT_RUN = 1;

/** Whether every character of `needle` appears in `hay` in order. */
export function runsInOrder(hay: string, needle: string): boolean {
  let at = 0;
  for (const letter of needle) {
    at = hay.indexOf(letter, at);
    if (at === -1) {
      return false;
    }
    at += 1;
  }
  return true;
}

function wordScore(hay: string, word: string, whole: number, run: number): number {
  if (hay.includes(word)) {
    return whole;
  }
  return runsInOrder(hay, word) ? run : 0;
}

/** The score one query word gives a note, or 0 when it misses. */
function scoreWord(note: ReferenceNote, word: string): number {
  const name = note.name.toLowerCase();
  const byName = wordScore(name, word, NAME_WHOLE, NAME_RUN);
  if (byName > 0) {
    return byName;
  }
  let best = 0;
  for (const ingredient of note.ingredients) {
    best = Math.max(
      best,
      wordScore(ingredient.toLowerCase(), word, INGREDIENT_WHOLE, INGREDIENT_RUN),
    );
  }
  return best;
}

/** The notes that hold every query word, closest first, then by name. */
export function searchReferences(
  notes: ReferenceNote[],
  query: string,
): ReferenceNote[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) {
    return [];
  }
  const scored: { note: ReferenceNote; score: number }[] = [];
  for (const note of notes) {
    let total = 0;
    for (const word of words) {
      const score = scoreWord(note, word);
      if (score === 0) {
        total = 0;
        break;
      }
      total += score;
    }
    if (total > 0) {
      scored.push({ note, score: total });
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || a.note.name.localeCompare(b.note.name))
    .map((hit) => hit.note);
}
