import { todayIso } from "../../lib/dates";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { ParsedCapture } from "./parse";

/** The frontmatter-only content of a captured task note. */
export function captureContent(
  parsed: ParsedCapture,
  listName?: string,
): string {
  const lines = ["---", 'kind: "[[tasks]]"', `created: ${todayIso()}`];
  if (parsed.due) {
    lines.push(`due: ${parsed.due}`);
  }
  if (listName) {
    lines.push("lists:");
    lines.push(`  - [[${listName}]]`);
  }
  if (parsed.reminders?.length) {
    lines.push("reminders:");
    for (const reminder of parsed.reminders) {
      lines.push(`  - ${reminder}`);
    }
  }
  if (parsed.recurrence) {
    lines.push(`recurrence: "${parsed.recurrence}"`);
  }
  lines.push("---", "");
  return `${lines.join("\n")}\n`;
}

export type CaptureTarget =
  | { kind: "main" }
  | { kind: "list"; name: string; uri: string };

/**
 * A file name a document provider accepts. A task name is free text,
 * so it can carry a slash or a colon; a document provider refuses
 * those and the write fails. Illegal characters become spaces, and a
 * name with nothing left becomes "task".
 */
export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, 80)
    .trim();
  return cleaned === "" ? "task" : cleaned;
}

/**
 * The row a capture makes, before the file exists: the name, the file
 * name, the note text, and the frontmatter the row renders from. One
 * source for the optimistic row and the write, so the two cannot drift.
 */
export function captureDraft(
  parsed: ParsedCapture,
  target: CaptureTarget,
  preselectedDue?: string,
): {
  name: string;
  fileName: string;
  content: string;
  data: TaskFrontmatter;
} {
  const due = preselectedDue && !parsed.due ? preselectedDue : parsed.due;
  const listName = target.kind === "list" ? target.name : undefined;
  const content = captureContent({ ...parsed, due }, listName);
  return {
    name: parsed.name,
    fileName: `${safeFileName(parsed.name)}.md`,
    content,
    data: {
      kind: "[[tasks]]",
      created: todayIso(),
      ...(due ? { due } : {}),
      ...(listName ? { lists: [`[[${listName}]]`] } : {}),
      ...(parsed.reminders?.length ? { reminders: parsed.reminders } : {}),
      ...(parsed.recurrence ? { recurrence: parsed.recurrence } : {}),
    },
  };
}
