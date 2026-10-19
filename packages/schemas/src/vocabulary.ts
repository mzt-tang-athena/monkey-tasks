import { z } from "zod";

/**
 * The vault vocabulary, as frontmatter values.
 *
 * Notes store wikilink-valued properties in their quoted form, for
 * example `status: "[[active]]"`. Dates are `YYYY-MM-DD`; datetimes are
 * `YYYY-MM-DDTHH:MM`, seconds optional. Everything unknown is
 * preserved, never rejected, so notes keep whatever frontmatter
 * Obsidian plugins add.
 */

/** A wikilink-valued frontmatter value, for example "[[digital]]". */
export const wikilink = z.preprocess(
  (raw) => {
    if (typeof raw !== "string") {
      return raw;
    }
    const value = raw.trim();
    return /^\[\[[^\]]+\]\]$/.test(value) ? value : `[[${value}]]`;
  },
  z.string().regex(/^\[\[[^\]]+\]\]$/, "expected a wikilink like \"[[name]]\""),
);
export type Wikilink = z.infer<typeof wikilink>;

/** The target inside a wikilink: "[[digital]]" -> "digital". */
export function wikilinkTarget(link: Wikilink): string {
  return link.slice(2, -2);
}

/** Date only: YYYY-MM-DD. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected a date like 2026-10-21");
export type IsoDate = z.infer<typeof isoDate>;

/** Date or datetime: YYYY-MM-DD or YYYY-MM-DDTHH:MM(:SS). */
export const dateOrDatetime = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/,
    "expected a date like 2026-10-21 or a datetime like 2026-10-21T15:00",
  );
export type DateOrDatetime = z.infer<typeof dateOrDatetime>;

/** Datetime: YYYY-MM-DDTHH:MM(:SS). */
export const isoDatetime = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
    "expected a datetime like 2026-10-21T15:00",
  );
export type IsoDatetime = z.infer<typeof isoDatetime>;

/**
 * An iCalendar recurrence rule (RFC 5545 RRULE), for example
 * "FREQ=MONTHLY". Stored as one string; parsed with rrule.js by
 * clients, never here.
 */
export const recurrenceRule = z
  .string()
  .min(1)
  .regex(/^[A-Z]+=/, "expected an RRULE like FREQ=MONTHLY");
export type RecurrenceRule = z.infer<typeof recurrenceRule>;

/**
 * Deed status. Canonical storage is the quoted wikilink form. Bare
 * values ("backlog") exist in older notes and are tolerated by wrapping
 * them; the app's write path and ticket 0005 canonicalize them.
 */
const statusValues = ["backlog", "active", "done", "dropped", "someday"] as const;

export const deedStatus = z.preprocess(
  (raw) =>
    typeof raw === "string" && (statusValues as readonly string[]).includes(raw)
      ? `[[${raw}]]`
      : raw,
  z.enum(["[[backlog]]", "[[active]]", "[[done]]", "[[dropped]]", "[[someday]]"]).nullish(),
);
export type DeedStatus = NonNullable<z.infer<typeof deedStatus>>;

const optionalList = <T extends z.ZodTypeAny>(value: T) =>
  // Single values exist in the vault; normalize them into one-item lists.
  z.preprocess(
    (raw) => (raw == null || Array.isArray(raw) ? raw : [raw]),
    z.array(value).nullish(),
  ); // empty properties arrive as null

/** Frontmatter of a task note, per ticket 0004. */
export const taskFrontmatter = z
  .object({
    kind: z.literal("[[tasks]]"),
    created: isoDate,
    completed: isoDate.nullish(),
    due: dateOrDatetime.nullish(),
    reminders: optionalList(isoDatetime),
    recurrence: recurrenceRule.nullish(),
    lists: optionalList(wikilink),
  })
  .loose();
export type TaskFrontmatter = z.infer<typeof taskFrontmatter>;

/** Frontmatter of a deed note, matching the existing vault shape. */
export const deedFrontmatter = z
  .object({
    kind: z.literal("[[deeds]]"),
    status: deedStatus,
    "parent deed": wikilink.nullish(),
    categories: optionalList(wikilink),
    types: optionalList(wikilink), // deprecated; tolerated until 0005
    after: optionalList(wikilink), // becomes "blocked by" in 0005
    "blocked by": optionalList(wikilink),
    created: isoDate.nullish(),
    due: dateOrDatetime.nullish(),
    reminders: optionalList(isoDatetime),
    recurrence: recurrenceRule.nullish(),
    completed: isoDate.nullish(),
  })
  .loose();
export type DeedFrontmatter = z.infer<typeof deedFrontmatter>;

/** Frontmatter of a list note, per ticket 0004. */
export const listFrontmatter = z
  .object({
    kind: z.literal("[[lists]]"),
    created: isoDate,
  })
  .loose();
export type ListFrontmatter = z.infer<typeof listFrontmatter>;

/** A task is done exactly when its completed date is present. */
export function taskIsDone(task: TaskFrontmatter): boolean {
  return task.completed != null && task.completed !== "";
}

/**
 * A deed is done through its status property; the completed date is
 * the timestamp of that moment. Absent status means not done.
 */
export function deedIsDone(deed: DeedFrontmatter): boolean {
  return deed.status === "[[done]]";
}
