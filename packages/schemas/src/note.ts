import { z } from "zod";
import { parseFrontmatter } from "./frontmatter.js";
import type { ParsedNote } from "./frontmatter.js";

export type ValidatedNote<S extends z.ZodType> = {
  note: ParsedNote;
  data: z.output<S> | null;
  errors: z.ZodError<z.output<S>> | null;
};

/**
 * Parse a vault markdown file against one of the vocabulary schemas.
 * Returns the parsed note and a validation result; valid keeps the
 * parsed frontmatter, invalid carries the Zod errors while still
 * returning the note, so callers can render or migrate broken notes
 * instead of crashing on them.
 */
export function validateNote<S extends z.ZodObject>(
  fileName: string,
  text: string,
  schema: S,
): ValidatedNote<S> {
  const note = parseFrontmatter(fileName, text);
  const result = schema.safeParse(note.values);
  if (result.success) {
    return { note, data: result.data, errors: null };
  }
  return { note, data: null, errors: result.error };
}
