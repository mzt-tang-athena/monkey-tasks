import { nowStamp } from "@/utils/dates";
import { serializeValue } from "@/utils/yaml";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { CaptureTarget, ParsedCapture } from "@/types/task";
import { safeFileName } from "@/lib/vault/file-name";
import { monthEndRule } from "@/lib/recurrence";

/** The rule capture writes: month-end tasks get the rule for their due day. */
function ruleFor(parsed: ParsedCapture): string | undefined {
  return parsed.recurrence && parsed.due
    ? monthEndRule(parsed.recurrence, parsed.due)
    : parsed.recurrence;
}

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
    lines.push(`list: ${serializeValue(`[[${listName}]]`)}`);
  }
  if (parsed.reminders?.length) {
    lines.push("reminders:", serializeValue(parsed.reminders));
  }
  const recurrence = ruleFor(parsed);
  if (recurrence) {
    lines.push(`recurrence: "${recurrence}"`);
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
  const recurrence = ruleFor({ ...parsed, due });
  const content = captureContent({ ...parsed, due }, listName, created);
  return {
    name: parsed.name,
    fileName: `${safeFileName(parsed.name)}.md`,
    content,
    data: {
      kind: "[[tasks]]",
      created,
      ...(due ? { due } : {}),
      ...(listName ? { list: `[[${listName}]]` } : {}),
      ...(parsed.reminders?.length ? { reminders: parsed.reminders } : {}),
      ...(recurrence ? { recurrence } : {}),
    },
  };
}
