import { frontmatterSpan } from "@/lib/vault/frontmatter";

/**
 * The daily note's grammar (ADR 20261112-journal-format). Text in,
 * journal out. Nothing here touches the vault: `daily-note.ts` reads
 * and writes the file.
 *
 * The grammar is tolerant. A block the app did not write still parses,
 * an unknown line ends a block instead of failing the note, and every
 * byte outside the appended block is preserved.
 */

/** A piece of one line of text, as the page draws it. */
export type TextSegment =
  | { kind: "text"; text: string }
  /** A `[[name]]` link. `text` is what shows: the alias or the name. */
  | { kind: "link"; text: string; name: string }
  /** An inline `#tag` the operator wrote, such as `#protein`. */
  | { kind: "tag"; text: string }
  /** The `Ate:` prefix of a food bullet, shown as a label. */
  | { kind: "ate"; text: string };

/** A food bullet, as the Food strip shows it. */
export type FoodLine = {
  /** The owning entry's id, so the strip and the page name one bullet. */
  id: string;
  /** The block's time as written, such as "12:40". */
  time: string;
  /** Plain text: no `Ate:`, no `#food`, links as their names. */
  label: string;
};

/** One `- ` bullet under a time line. */
export type JournalEntry = {
  /** The block's id and the bullet's index. */
  id: string;
  /** The bullet with `- ` removed. */
  text: string;
  /** Set when the bullet carries the `#food` tag. */
  food: FoodLine | null;
};

/** A time line and the bullets it owns. */
export type JournalBlock = {
  /** A hash of the block's lines and its ordinal (`blockId`). */
  id: string;
  /** The time line as written, such as "9:05". */
  time: string;
  /** The block's trimmed lines joined with "\n", whatever the file's EOL. */
  raw: string;
  entries: JournalEntry[];
};

/** One day, ready to render. Derived from the note text, never stored. */
export type JournalPage = {
  /** `YYYY-MM-DD`. */
  day: string;
  blocks: JournalBlock[];
  /** Every food entry in the note, in file order (newest last). */
  food: FoodLine[];
};

/** One send. A retry writes this same draft again. */
export type JournalEntryDraft = {
  /** `HH:MM`, zero padded, local time. */
  time: string;
  /** The block to append, lines joined with "\n", no trailing newline. */
  block: string;
};

/** The embed Obsidian's daily template ends a note with. */
export const DAILY_EMBED = "![[daily.base]]";

const TIME_LINE = /^\d{1,2}:\d{2}$/;
const ATE_PREFIX = /^ate:\s*/i;
const LINK = /\[\[([^[\]|#]+)(?:#[^[\]|]*)?(?:\|([^[\]]*))?\]\]/g;
const TAG = /(^|\s)(#[\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu;

/** A line that is only a clock time. The grammar's only block start. */
export function isTimeLine(line: string): boolean {
  return TIME_LINE.test(line.trim());
}

/** The local clock as the note writes it, `HH:MM`. */
export function timeLine(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function isFoodToken(token: string): boolean {
  return token.replace(/^[^#\p{L}\p{N}_]+|[^\p{L}\p{N}_]+$/gu, "").toLowerCase() === "#food";
}

/**
 * Whether a bullet carries the machine marker. The tag is matched as a
 * whole token, so `#foodie` and `#food-based` are other tags.
 */
export function hasFoodTag(text: string): boolean {
  return text.split(/\s+/).some(isFoodToken);
}

function withoutFoodTag(text: string): string {
  return text
    .split(/\s+/)
    .filter((token) => token !== "" && !isFoodToken(token))
    .join(" ");
}

/** The `[[name]]` links in a line, in order. */
export function linksIn(
  text: string,
): { name: string; label: string; start: number; end: number }[] {
  return [...text.matchAll(LINK)].map((match) => {
    const name = match[1].trim();
    const alias = match[2]?.trim();
    return {
      name,
      label: alias == null || alias === "" ? name : alias,
      start: match.index,
      end: match.index + match[0].length,
    };
  });
}

function tagSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let at = 0;
  for (const match of text.matchAll(TAG)) {
    const start = match.index + match[1].length;
    if (start > at) {
      segments.push({ kind: "text", text: text.slice(at, start) });
    }
    segments.push({ kind: "tag", text: match[2] });
    at = start + match[2].length;
  }
  if (at < text.length) {
    segments.push({ kind: "text", text: text.slice(at) });
  }
  return segments;
}

/** A line cut into plain text, links and tags. */
export function segmentsOf(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let at = 0;
  for (const link of linksIn(text)) {
    segments.push(...tagSegments(text.slice(at, link.start)));
    segments.push({ kind: "link", text: link.label, name: link.name });
    at = link.end;
  }
  segments.push(...tagSegments(text.slice(at)));
  return segments;
}

/**
 * The segments the page draws for one bullet. A food bullet shows its
 * `Ate:` prefix as a label and hides the `#food` marker. Its other tags
 * stay, because they are the operator's own labels.
 */
export function entrySegments(entry: JournalEntry): TextSegment[] {
  if (entry.food == null) {
    return segmentsOf(entry.text);
  }
  const prefixed = ATE_PREFIX.test(entry.text);
  const rest = withoutFoodTag(entry.text.replace(ATE_PREFIX, ""));
  const body = segmentsOf(rest);
  if (!prefixed) {
    return body;
  }
  return [{ kind: "ate", text: "Ate" }, { kind: "text", text: " " }, ...body];
}

/** The plain words of a line: links as their names, tags kept. */
function plainOf(text: string): string {
  return segmentsOf(text)
    .map((segment) => segment.text)
    .join("");
}

/** The text the Food strip shows for one food bullet. */
export function foodLabel(text: string): string {
  return plainOf(withoutFoodTag(text.replace(ATE_PREFIX, "")));
}

/** FNV-1a, 32 bits. A render key only, never a security check. */
export function blockId(raw: string, ordinal: number): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16).padStart(8, "0")}:${ordinal}`;
}

/**
 * The blocks in a note, in file order. The frontmatter is skipped, so a
 * time in a property never starts a block. A bullet outside any block,
 * such as a to-do list, is kept in the file and not shown.
 */
export function parseDailyNote(text: string): JournalBlock[] {
  const body = text.slice(frontmatterSpan(text)?.end ?? 0);
  const found: { time: string; bullets: string[] }[] = [];
  let current: { time: string; bullets: string[] } | null = null;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (isTimeLine(line)) {
      current = { time: line, bullets: [] };
      found.push(current);
    } else if (current != null && line.startsWith("- ")) {
      current.bullets.push(line.slice(2));
    } else {
      current = null;
    }
  }
  return found.map(({ time, bullets }, ordinal) => {
    const raw = [time, ...bullets.map((bullet) => `- ${bullet}`)].join("\n");
    const id = blockId(raw, ordinal);
    return {
      id,
      time,
      raw,
      entries: bullets.map((text, index) => {
        const entryId = `${id}:${index}`;
        const food = hasFoodTag(text)
          ? { id: entryId, time, label: foodLabel(text) }
          : null;
        return { id: entryId, text, food };
      }),
    };
  });
}

/** The page for one day: blocks in file order and the food lines. */
export function journalPage(day: string, text: string): JournalPage {
  const blocks = parseDailyNote(text);
  const food = blocks.flatMap((block) =>
    block.entries.flatMap((entry) => (entry.food == null ? [] : [entry.food])),
  );
  return { day, blocks, food };
}

/**
 * One send, built once. Blank lines drop out, a leading `- ` is dropped
 * so the bullet does not double, and the Food chip adds `Ate: ` and
 * `#food` only where they are missing. Null when nothing is left.
 */
export function buildEntry({
  text,
  food,
  at,
}: {
  text: string;
  food: boolean;
  at: Date;
}): JournalEntryDraft | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^-\s+/, "").trim())
    .filter((line) => line !== "")
    .map((line) => {
      if (!food) {
        return line;
      }
      const prefixed = /^ate:/i.test(line) ? line : `Ate: ${line}`;
      return hasFoodTag(prefixed) ? prefixed : `${prefixed} #food`;
    });
  if (lines.length === 0) {
    return null;
  }
  const time = timeLine(at);
  return {
    time,
    block: [time, ...lines.map((line) => `- ${line}`)].join("\n"),
  };
}

type Line = { start: number; end: number; next: number };

function linesOf(text: string): Line[] {
  const lines: Line[] = [];
  const pattern = /[^\r\n]*(\r\n|\n|\r)?/g;
  for (const match of text.matchAll(pattern)) {
    if (match[0] === "") {
      break;
    }
    lines.push({
      start: match.index,
      end: match.index + match[0].length - (match[1]?.length ?? 0),
      next: match.index + match[0].length,
    });
  }
  return lines;
}

/**
 * The whole append rule. The new block goes after the last line with
 * content, or before a trailing `![[daily.base]]` and the blank lines
 * in front of it. Every byte before and after the insert is kept, the
 * note keeps its own line ending, and the block sits one blank line
 * below the text above it and at least one above the embed.
 *
 * `retry` is a send whose answer was lost. If the note already ends
 * with the same block, the first try landed, so nothing is written. A
 * first send always writes, so two equal entries in one minute both
 * land.
 */
export function planAppend(
  text: string,
  block: string,
  { retry = false }: { retry?: boolean } = {},
): { text: string; appended: boolean } {
  if (block.trim() === "") {
    return { text, appended: false };
  }
  if (retry && parseDailyNote(text).at(-1)?.raw === block) {
    return { text, appended: false };
  }

  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = linesOf(text);
  const content = (index: number) =>
    text.slice(lines[index].start, lines[index].end).trim();
  const lastContent = (before: number) => {
    let index = before - 1;
    while (index >= 0 && content(index) === "") {
      index -= 1;
    }
    return index;
  };

  let last = lastContent(lines.length);
  const embed = last >= 0 && content(last) === DAILY_EMBED;
  if (embed) {
    last = lastContent(last);
  }

  let cut = 0;
  let head = "";
  if (last >= 0) {
    const line = lines[last];
    cut = line.next;
    head = text.slice(0, cut) + (line.next === line.end ? eol : "") + eol;
  }
  const tail = text.slice(cut);
  const gap = embed && !/^[ \t]*(\r\n|\n|\r)/.test(tail) ? eol : "";
  const inserted = block.split("\n").join(eol) + eol + gap;
  return { text: head + inserted + tail, appended: true };
}
