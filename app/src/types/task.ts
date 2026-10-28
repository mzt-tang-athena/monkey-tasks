import type { TaskFrontmatter } from "@monkey-tasks/schemas";

export type TaskItem = {
  /**
   * The row's identity for rendering. It is the uri for a note read
   * from the vault, and the provisional string for a capture that is
   * still being written; it stays put when the real uri arrives, so
   * the row keeps its place instead of remounting.
   */
  id: string;
  uri: string;
  /** File name with extension, as SAF reports it. */
  fileName: string;
  /** Display name without extension: the task name. */
  name: string;
  /** Full file text; the source for surgical edits. */
  text: string;
  data: TaskFrontmatter | null;
  /** Body below the frontmatter. */
  body: string;
  /** Why the frontmatter failed, when it did. Absent on a valid note. */
  errors?: string[];
};

/** A list note, as the store exposes it: a tab name and its file. */
export type ListItem = {
  /** The note's file name without .md: the tab label. */
  name: string;
  uri: string;
};

/** A note in Lists that fails the list frontmatter, kept for repair. */
export type BrokenList = {
  /** The note's file name without .md. */
  name: string;
  uri: string;
  /** One "path: message" line per frontmatter issue. */
  errors: string[];
};

export type CaptureTarget =
  | { kind: "main" }
  | { kind: "list"; name: string };

export type ParsedCapture = {
  name: string;
  /** Date (YYYY-MM-DD) or datetime (YYYY-MM-DDTHH:MM), local time. */
  due?: string;
  /** Datetimes when the phone buzzes; set when the capture has a time. */
  reminders?: string[];
  /** One RRULE string, for example FREQ=MONTHLY. */
  recurrence?: string;
  /** The matched phrases, so callers can show what was consumed.
      Spans were dropped: stripping and squashing between matches
      made input indices drift, and no caller used them. */
  matches?: { kind: "date" | "recurrence"; text: string }[];
};

/** The fields the task editor can change on a note. */
export type TaskEdit = {
  name: string;
  due: string | null;
  recurrence: string | null;
  lists: string[];
  reminders: string[];
  body: string;
};
