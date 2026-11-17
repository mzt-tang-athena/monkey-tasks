import { frontmatterSpan } from "@/lib/vault/frontmatter";

/** The folder under the granted root that holds the inbox notes. */
export const INBOX_FOLDER = "Inbox";

/** The most lines a card's preview shows. */
export const PREVIEW_LINES = 8;

/** The most characters a card's preview shows, the ellipsis included. */
export const PREVIEW_CHARS = 240;

/** The most characters a typed title's slug carries. */
export const SLUG_CHARS = 60;

/**
 * One note in `Inbox/`, as the cards read it.
 *
 * The file name is the only metadata the vault promises. It holds the
 * title and the recency. The preview is the body with the markdown
 * marks gone and the indentation flattened.
 */
export type InboxNote = {
  /** The vault uri. The note's identity. */
  uri: string;
  /** The name as the vault spells it, `202611041210.md`. */
  fileName: string;
  /** The name without `.md`, including a provider ` (n)` suffix. */
  stem: string;
  /** The card's title. */
  title: string;
  /** The card's plain text preview. */
  preview: string;
  /** The local `YYYYMMDDHHmm` the name carries, or null. */
  sortKey: number | null;
};

/** What the composer holds. The title is optional. */
export type NoteDraft = { title: string; body: string };

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** A bare stamp, with the provider's collision suffix. */
const STAMP = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})( \(\d+\))?$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isRealDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  if (hour > 23 || minute > 59) {
    return false;
  }
  // Date rolls an impossible day into the next month. Comparing the
  // parts back catches 29 February in a leap-less year and 31 April.
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function stampNumber(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  return (
    year * 100_000_000 +
    month * 1_000_000 +
    day * 10_000 +
    hour * 100 +
    minute
  );
}

/**
 * The card's title.
 *
 * A bare `YYYYMMDDHHmm` stem is a moment the app wrote, so it shows as
 * the local date and time. Every other stem is a name a person wrote,
 * so it shows exactly as written. No slug is split off and no case
 * changes. The provider's ` (n)` suffix stays, so the title still names
 * the file.
 */
export function noteTitle(stem: string): string {
  const match = STAMP.exec(stem);
  if (match == null) {
    return stem;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (!isRealDate(year, month, day, hour, minute)) {
    return stem;
  }
  const suffix = match[6] ?? "";
  return `${day} ${MONTHS[month - 1]} ${year}, ${pad(hour)}:${pad(minute)}${suffix}`;
}

/**
 * The local instant a file name carries, as `YYYYMMDDHHmm`, or null.
 *
 * Three shapes carry one: the app's own stamp, a stamp with a slug, and
 * a date with a slug but no time. A date without a time sits at the
 * start of that day.
 */
export function sortKeyOf(stem: string): number | null {
  const stamp = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(?!\d)/.exec(stem);
  if (stamp != null) {
    const [year, month, day, hour, minute] = stamp
      .slice(1, 6)
      .map(Number) as [number, number, number, number, number];
    return isRealDate(year, month, day, hour, minute)
      ? stampNumber(year, month, day, hour, minute)
      : null;
  }
  const dashed = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(?!\d)/.exec(stem);
  if (dashed != null) {
    const [year, month, day, hour, minute] = dashed
      .slice(1, 6)
      .map(Number) as [number, number, number, number, number];
    return isRealDate(year, month, day, hour, minute)
      ? stampNumber(year, month, day, hour, minute)
      : null;
  }
  const date = /^(\d{4})(\d{2})(\d{2})(?!\d)/.exec(stem);
  if (date != null) {
    const [year, month, day] = date.slice(1, 4).map(Number) as [
      number,
      number,
      number,
    ];
    return isRealDate(year, month, day, 0, 0)
      ? stampNumber(year, month, day, 0, 0)
      : null;
  }
  return null;
}

/**
 * The notes in the order the cards show them. Dated notes come first,
 * newest first. Equal stamps break on the stem, so ` (1)` sits above
 * its twin. Undated notes come last, by name.
 */
export function sortInboxNotes(notes: readonly InboxNote[]): InboxNote[] {
  return [...notes].sort((a, b) => {
    if (a.sortKey == null && b.sortKey == null) {
      return a.stem.localeCompare(b.stem);
    }
    if (a.sortKey == null) {
      return 1;
    }
    if (b.sortKey == null) {
      return -1;
    }
    if (a.sortKey !== b.sortKey) {
      return b.sortKey - a.sortKey;
    }
    return b.stem.localeCompare(a.stem);
  });
}

/**
 * The head and the body of a note. The head is the whole frontmatter
 * block, including the closing fence and its newline, or "". The two
 * parts join back to the exact text.
 */
export function splitNote(text: string): { head: string; body: string } {
  const span = frontmatterSpan(text);
  if (span == null) {
    return { head: "", body: text };
  }
  return { head: text.slice(0, span.end), body: text.slice(span.end) };
}

/** One line of markdown as plain readable text. */
export function plainLine(line: string): string {
  let text = line.trim();
  if (text === "" || /^(```|~~~)/.test(text)) {
    return "";
  }
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(text)) {
    return "";
  }
  text = text.replace(/^#{1,6}\s+/, "");
  text = text.replace(/^>\s?/, "");
  text = text.replace(/^([-*+]|\d+\.)\s+/, "");
  text = text.replace(/^\[[ xX]\]\s+/, "");
  text = text.replace(/!\[\[[^\]]*\]\]/g, "");
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, alias) =>
    alias == null ? target : alias,
  );
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  text = text.replace(/`([^`]*)`/g, "$1");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/~~([^~]+)~~/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  return text.replace(/\s+/g, " ").trim();
}

/**
 * The card's plain text preview: the body's first lines, with the
 * marks gone and the indentation flattened. At most eight lines and 240
 * characters, with an ellipsis where it was cut.
 */
export function previewOfBody(body: string): string {
  const lines = body
    .split(/\r?\n/)
    .map(plainLine)
    .filter((line) => line !== "");
  let preview = lines.slice(0, PREVIEW_LINES).join("\n");
  let cut = lines.length > PREVIEW_LINES;
  if (preview.length > PREVIEW_CHARS) {
    preview = preview.slice(0, PREVIEW_CHARS - 1);
    const space = preview.lastIndexOf(" ");
    if (space > 0) {
      preview = preview.slice(0, space);
    }
    preview = preview.trimEnd();
    cut = true;
  }
  return cut ? `${preview}…` : preview;
}

/** The local capture stamp, `YYYYMMDDHHmm`. */
export function stampOf(at: Date): string {
  return `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}${pad(
    at.getHours(),
  )}${pad(at.getMinutes())}`;
}

/** A typed title as a kebab slug. Empty when nothing survives. */
export function slugify(title: string): string {
  const ascii = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const slug = ascii.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (slug.length <= SLUG_CHARS) {
    return slug;
  }
  const cut = slug.slice(0, SLUG_CHARS);
  const at = cut.lastIndexOf("-");
  return (at > 0 ? cut.slice(0, at) : cut).replace(/-+$/, "");
}

/** The file name a new note gets, `stamp.md` or `stamp-slug.md`. */
export function inboxFileName(at: Date, title: string): string {
  const slug = slugify(title);
  return `${stampOf(at)}${slug === "" ? "" : `-${slug}`}.md`;
}

/** The card model for one file. The one place a note is built. */
export function toInboxNote(
  file: { uri: string; fileName: string },
  text: string,
): InboxNote {
  const stem = file.fileName.replace(/\.md$/i, "");
  return {
    uri: file.uri,
    fileName: file.fileName,
    stem,
    title: noteTitle(stem),
    preview: previewOfBody(splitNote(text).body),
    sortKey: sortKeyOf(stem),
  };
}
