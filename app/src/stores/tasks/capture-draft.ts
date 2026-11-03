import { nowStamp } from "@/utils/dates";
import { serializeValue } from "@/utils/yaml";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { CaptureTarget, ParsedCapture } from "@/types/task";
import { safeFileName } from "@/lib/vault/file-name";

/** The frontmatter-only content of a captured task note. */
export function captureContent(
  parsed: ParsedCapture,
  listName?: string,
  created = nowStamp(),
): string {
  const lines = ["---", 'kind: "[[tasks]]"', `created: ${created}`];
  if (parsed.due) {
    lines.push(`due: ${parsed.due}`);
  }
  if (listName) {
    lines.push("lists:", serializeValue([`[[${listName}]]`]));
  }
  if (parsed.reminders?.length) {
    lines.push("reminders:", serializeValue(parsed.reminders));
  }
  if (parsed.recurrence) {
    lines.push(`recurrence: "${parsed.recurrence}"`);
  }
  lines.push("---", "");
  return `${lines.join("\n")}\n`;
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
  const created = nowStamp();
  const content = captureContent({ ...parsed, due }, listName, created);
  return {
    name: parsed.name,
    fileName: `${safeFileName(parsed.name)}.md`,
    content,
    data: {
      kind: "[[tasks]]",
      created,
      ...(due ? { due } : {}),
      ...(listName ? { lists: [`[[${listName}]]`] } : {}),
      ...(parsed.reminders?.length ? { reminders: parsed.reminders } : {}),
      ...(parsed.recurrence ? { recurrence: parsed.recurrence } : {}),
    },
  };
}
