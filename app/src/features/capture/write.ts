import { todayIso } from "../../lib/dates";
import { createNote } from "../vault/notes";
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
 * Write a captured task. Main targets write no lists property;
 * a list target adds its wikilink natively to the frontmatter.
 */
export async function writeCapture(
  tasksDirUri: string,
  parsed: ParsedCapture,
  target: CaptureTarget,
  preselectedDue?: string,
): Promise<{ uri: string; fileName: string }> {
  const due = preselectedDue && !parsed.due ? preselectedDue : parsed.due;
  const content = captureContent(
    { ...parsed, due },
    target.kind === "list" ? target.name : undefined,
  );
  const fileName = `${parsed.name}.md`;
  const uri = await createNote(tasksDirUri, fileName, content);
  return { uri, fileName };
}
