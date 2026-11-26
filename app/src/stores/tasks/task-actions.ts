import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import { monthEndRule, nextAfter } from "@/lib/recurrence";
import type { VaultAdapter } from "@/lib/vault/adapter";
import { setBlockList, updateProperty } from "@/lib/vault/frontmatter";
import { createNote, writeNoteIfUnchanged } from "@/lib/vault/notes";
import { nowStamp } from "@/utils/dates";
import type { TaskItem } from "@/types/task";
import { applyPatch } from "./patch";
import { spawnContent, spawnFileName, type SpawnInput } from "./spawn";
import { taskFromText } from "./task-notes";

/**
 * The writes behind a tick and a reschedule, with no React and no
 * query cache in reach. The in-app tick and the notification buttons
 * both call them, so a button on a killed app writes the same note a
 * tap in the list does.
 */

/** A task whose frontmatter read. */
export type ReadTask = TaskItem & { data: TaskFrontmatter };

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A completion that failed after its next occurrence was made, and the
 * delete of that occurrence failed too. The new note stays, so its row
 * stays.
 */
export class SuccessorKeptError extends Error {
  readonly successor: TaskItem;

  constructor(cause: unknown, removal: unknown, successor: TaskItem) {
    super(
      `${messageOf(cause)}. The next occurrence could not be taken back: ${messageOf(removal)}`,
    );
    this.name = "SuccessorKeptError";
    this.successor = successor;
  }
}

/** Everything the next occurrence of `task` keeps, due on `due`. */
export function spawnInput(task: TaskItem, due: string): SpawnInput {
  const data = task.data;
  return {
    title: data?.title ?? task.name,
    previous: task.fileName.replace(/\.md$/, ""),
    due,
    // A bare rule on a late due day becomes the month-end rule, so the
    // next note keeps the day (ADR 0042).
    recurrence:
      data?.recurrence == null || data.due == null
        ? (data?.recurrence ?? "")
        : monthEndRule(data.recurrence, data.due),
    list: data?.list ?? null,
    // A date-only due carries no time of day, so no alarm.
    reminders: due.includes("T") ? [due] : [],
    alertWeight: data?.["alert weight"] ?? "quiet",
    body: task.body,
  };
}

/**
 * The status a toggle writes beside `completed`. A deed is a task with
 * a status, and the contract keeps the two in step: a tick makes the
 * deed done, and a reopen puts it back in the queue, because the note
 * does not record which status it held before. A task with no status
 * writes none.
 */
export function statusFor(
  task: TaskItem,
  to: "done" | "open",
): "[[done]]" | "[[backlog]]" | undefined {
  if (task.data?.status == null) {
    return undefined;
  }
  return to === "done" ? "[[done]]" : "[[backlog]]";
}

/** The next date of a recurring task, or null for a plain one. */
export function nextDue(task: TaskItem): string | null {
  const rule = task.data?.recurrence;
  return rule ? nextAfter(rule, task.data?.due) : null;
}

export type Completion = {
  before: ReadTask;
  after: TaskItem;
  /** The next occurrence this tick made. */
  successor?: TaskItem;
};

export type CompleteOptions = {
  /** Make the next occurrence of a recurring task. */
  spawn: boolean;
  /** The next note's row id; its uri when absent. */
  successorId?: string;
  /** File names already in the task's folder. */
  taken: ReadonlySet<string>;
  /**
   * The next note a failed first try made and could not take back. This
   * try keeps it and only completes the task.
   */
  kept?: TaskItem;
};

/**
 * Complete a task as the list's tick does. The write checks the file
 * still holds the text it was read from, because a button and a tick
 * can reach the same note from two queues. The next occurrence comes
 * first: a failed create leaves the series as it was. A failed
 * completion takes the new note back, so the worst case is two open
 * occurrences, never a lost series (ADR 0027).
 */
export async function completeTask(
  adapter: VaultAdapter,
  before: ReadTask,
  options: CompleteOptions,
): Promise<Completion> {
  const after = applyPatch(before, {
    completed: nowStamp(),
    status: statusFor(before, "done"),
  });
  const due = options.spawn ? nextDue(before) : null;
  const writeCompletion = () =>
    writeNoteIfUnchanged(adapter, before.uri, before.text, after.text);
  if (due == null) {
    await writeCompletion();
    return { before, after };
  }
  if (options.kept != null) {
    await writeCompletion();
    return { before, after, successor: options.kept };
  }
  const input = spawnInput(before, due);
  const created = await createNote(
    adapter,
    adapter.parentOf(before.uri),
    spawnFileName(input.title, due, options.taken),
    spawnContent(input, nowStamp()),
    input.title,
  );
  const successor = taskFromText(
    {
      id: options.successorId ?? created.uri,
      uri: created.uri,
      fileName: created.fileName,
      name: input.title,
    },
    created.text,
  );
  try {
    await writeCompletion();
  } catch (error) {
    try {
      await adapter.remove(created.uri);
    } catch (removal) {
      throw new SuccessorKeptError(error, removal, successor);
    }
    throw error;
  }
  return { before, after, successor };
}

export type Rescheduled = { before: ReadTask; after: TaskItem };

/**
 * Move a task to a target moment: `due` and its one reminder both go to
 * `target`, a stored datetime, so the alarm rings then. The write checks
 * the file still holds the text it was read from. A month-end rule keeps
 * its day with the new due (ADR 0042).
 */
export async function rescheduleTask(
  adapter: VaultAdapter,
  before: ReadTask,
  target: string,
): Promise<Rescheduled> {
  let text = updateProperty(before.text, "due", target);
  const { recurrence, due } = before.data;
  if (recurrence != null) {
    const moved = due?.slice(0, 10) !== target.slice(0, 10);
    text = updateProperty(
      text,
      "recurrence",
      monthEndRule(recurrence, target, moved),
    );
  }
  text = setBlockList(text, "reminders", [target]);
  await writeNoteIfUnchanged(adapter, before.uri, before.text, text);
  const after = taskFromText(before, text);
  return { before, after };
}
