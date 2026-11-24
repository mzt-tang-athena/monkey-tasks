/** One note in the vault's References folder, as the picker lists it. */
export type ReferenceNote = {
  /** File name without .md: the task body's wikilink target. */
  name: string;
  /** The file, so the preview sheet reads no folder of its own. */
  uri: string;
  /** The whole file text. */
  text: string;
  /** The body below the frontmatter, for the preview. */
  body: string;
  /** Frontmatter ingredients, as written. */
  ingredients: string[];
  /** Frontmatter categories, with a wikilink's alias in words. */
  categories: string[];
  /** Frontmatter types, with a wikilink's alias in words. */
  types: string[];
};
