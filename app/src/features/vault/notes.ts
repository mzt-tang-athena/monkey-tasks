import * as FileSystem from "expo-file-system/legacy";

const { StorageAccessFramework } = FileSystem;

export async function readNote(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function writeNote(uri: string, content: string): Promise<void> {
  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

/** Create a note file in a folder and write it. Returns the new uri. */
export async function createNote(
  folderUri: string,
  fileName: string,
  content: string,
): Promise<string> {
  const uri = await StorageAccessFramework.createFileAsync(
    folderUri,
    fileName,
    "text/markdown",
  );
  await writeNote(uri, content);
  return uri;
}

type FrontmatterSpan = {
  body: string;
  start: number;
  end: number;
  /** Index right after the opening "---\n" line, where keys live. */
  insertAt: number;
};

function frontmatterSpan(text: string): FrontmatterSpan | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) {
    return null;
  }
  const insertAt = text.indexOf("\n", match.index) + 1;
  return {
    body: match[1],
    start: match.index,
    end: match.index + match[0].length,
    insertAt,
  };
}

function serializeValue(value: string | string[]): string {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "";
    }
    return `${value.map((item) => `  - ${item}`).join("\n")}`;
  }
  return value;
}

/**
 * Surgically edit one frontmatter property, preserving everything else
 * in the file byte for byte. `null` removes the property. List values
 * are written in the vault's block style.
 */
export function updateProperty(
  text: string,
  key: string,
  value: string | string[] | null,
): string {
  const span = frontmatterSpan(text);
  if (!span) {
    throw new Error("note has no frontmatter block");
  }
  const lines = span.body.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) =>
    new RegExp(`^${key}\\s*:`, "i").test(line),
  );
  if (keyIndex === -1) {
    if (value === null) {
      return text;
    }
    const serialized = serializeValue(value);
    const insert =
      serialized === ""
        ? [`${key}:`]
        : serialized.includes("\n")
          ? [`${key}:`, serialized]
          : [`${key}: ${serialized}`];
    lines.push(...insert);
    return replaceSpan(text, span, lines.join("\n"));
  }
  // Find the extent of the property: its line plus any block list
  // items that follow it.
  let endIndex = keyIndex + 1;
  while (endIndex < lines.length && /^ {2}- /.test(lines[endIndex])) {
    endIndex += 1;
  }
  if (value === null) {
    lines.splice(keyIndex, endIndex - keyIndex);
  } else {
    // Arrays always render in the vault's block style under the key.
    const replacement = Array.isArray(value)
      ? value.length === 0
        ? [`${key}:`]
        : [`${key}:`, serializeValue(value)]
      : value === ""
        ? [`${key}:`]
        : [`${key}: ${value}`];
    lines.splice(keyIndex, endIndex - keyIndex, ...replacement);
  }
  return replaceSpan(text, span, lines.join("\n"));
}

function replaceSpan(
  text: string,
  span: FrontmatterSpan,
  newBody: string,
): string {
  const before = text.slice(0, span.start);
  const after = text.slice(span.end);
  return `${before}---\n${newBody}\n---${after.startsWith("\n") ? "" : "\n"}${after}`;
}
