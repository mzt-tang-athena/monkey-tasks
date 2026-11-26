import { nowStamp } from "@/utils/dates";
import { serializeValue } from "@/utils/yaml";
import { parseFrontmatter, type TaskFrontmatter } from "@monkey-tasks/schemas";
import { attachReference } from "@/lib/references/links";
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
  references: string[] = [],
  /** A deed's status. Capture on Board writes backlog. */
  status?: string,
): string {
  const lines = ["---", 'kind: "[[tasks]]"', `created: ${created}`];
  if (status) {
    lines.push(`status: ${serializeValue(status)}`);
  }
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
  const content = `${lines.join("\n")}\n`;
  // The reference links are body paragraphs, written by the one rule
  // the editor uses, so a capture and a later attach cannot differ.
  return references.reduce((text, name) => attachReference(text, name), content);
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
  references: string[] = [],
): {
  name: string;
  fileName: string;
  content: string;
  /** The body the note holds, so the optimistic row draws its links. */
  body: string;
  data: TaskFrontmatter;
} {
  const due = preselectedDue && !parsed.due ? preselectedDue : parsed.due;
  const listName = target.kind === "list" ? target.name : undefined;
  // Board capture makes a backlog deed, so the note lands in Backlog.
  // Without a status Main would show it instead (ADR
  // 20261125-deed-board-is-the-kanban-list).
  const status = target.kind === "board" ? "[[backlog]]" : undefined;
  const created = nowStamp();
  const recurrence = ruleFor({ ...parsed, due });
  const fileName = `${safeFileName(parsed.name)}.md`;
  const content = captureContent(
    { ...parsed, due },
    listName,
    created,
    references,
    status,
  );
  return {
    name: parsed.name,
    fileName,
    content,
    body: parseFrontmatter(fileName, content).body,
    data: {
      kind: "[[tasks]]",
      created,
      "alert weight": "quiet",
      ...(status ? { status } : {}),
      ...(due ? { due } : {}),
      ...(listName ? { list: `[[${listName}]]` } : {}),
      ...(parsed.reminders?.length ? { reminders: parsed.reminders } : {}),
      ...(recurrence ? { recurrence } : {}),
    },
  };
}
