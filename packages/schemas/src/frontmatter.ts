/**
 * A small YAML-frontmatter parser, good enough for the vault's
 * vocabulary. Handles scalars (quoted or bare), empty values, and
 * two-space-indented list items. Anything richer is preserved as raw
 * strings and left to the client.
 */

export type ParsedNote = {
  /** Raw frontmatter values, strings as written; empty properties are null. */
  values: Record<string, string | string[] | null>;
  /** The note body below the frontmatter block. */
  body: string;
  /** The file name without extension, the note's title. */
  title: string;
};

export function parseFrontmatter(fileName: string, text: string): ParsedNote {
  const values: Record<string, string | string[] | null> = {};
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) {
    return { values, body: text, title: stripExtension(fileName) };
  }
  let currentKey: string | null = null;
  for (const line of match[1].split(/\r?\n/)) {
    const listItem = /^ {2}- (.*)$/.exec(line);
    if (listItem && currentKey) {
      const existing = values[currentKey];
      const list = Array.isArray(existing) ? [...existing] : [];
      if (existing != null && !Array.isArray(existing) && existing !== "") {
        list.push(existing);
      }
      list.push(unquote(listItem[1]));
      values[currentKey] = list;
      continue;
    }
    const pair = /^([^:\s][^:]*):\s?(.*)$/.exec(line);
    if (pair) {
      currentKey = pair[1].trim();
      const raw = pair[2];
      values[currentKey] = raw === "" ? null : unquote(raw);
    }
  }
  return {
    values,
    body: text.slice(match[0].length),
    title: stripExtension(fileName),
  };
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

function unquote(value: string): string {
  return value.replace(/^["'](.*)["']$/, "$1");
}
