import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { taskIsDone } from "@monkey-tasks/schemas";
import { monthEndRule, nextAfter } from "@/lib/recurrence";
import { createNote } from "@/lib/vault/notes";
import { useVault } from "@/lib/vault/vault-provider";
import { nowStamp } from "@/utils/dates";
import type { TaskItem } from "@/types/task";
import { applyPatch } from "../patch";
import { cachedRows } from "../query";
import {
  PENDING,
  insertRow,
  patchRow,
  pendingId,
  removeRow,
  rollbackRow,
  rowById,
  settleRow,
} from "../rows";
import {
  isUntouchedSpawn,
  spawnContent,
  spawnFileName,
  type SpawnInput,
} from "../spawn";
import { taskFromText } from "../task-notes";
import {
  messageOf,
  readRow,
  requireRow,
  useVaultMutation,
  type AlarmMove,
  type VaultIo,
  type VaultMutationSpec,
} from "./use-vault-mutation";
import type { RowStep } from "./use-patch-task";

export type ToggleVariables = {
  id: string;
  /**
   * The opposite of what the row showed when it was tapped. A toggle
   * whose note already holds this state changes nothing.
   */
  to: "done" | "open";
  /**
   * The provisional id of the next occurrence, set when a recurring
   * task goes to done and its rule has a next date (ADR 0027).
   */
  successorId?: string;
};

type ToggleContext = RowStep & { successorText?: string };

type Toggled = {
  before: TaskItem;
  after: TaskItem;
  /** The next occurrence a tick made. */
  successor?: TaskItem;
  /** The next occurrence an untick took back. */
  removed?: TaskItem;
  /** Shown in the failure list, though the write landed. */
  notice?: string;
};

/**
 * A completion that failed after its next occurrence was made, and the
 * delete of that occurrence failed too. The new note stays, so its row
 * stays.
 */
class SuccessorKeptError extends Error {
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
function spawnInput(task: TaskItem, due: string): SpawnInput {
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
    body: task.body,
  };
}

/** The next date of a recurring task, or null for a plain one. */
function nextDue(task: TaskItem): string | null {
  const rule = task.data?.recurrence;
  return rule ? nextAfter(rule, task.data?.due) : null;
}

/**
 * Whether the task is already in the state a toggle asks for. A retry
 * runs the variables of an old tap, and a later tap can have landed
 * that state since.
 */
function holds(task: TaskItem, to: ToggleVariables["to"]): boolean {
  return task.data != null && taskIsDone(task.data) === (to === "done");
}

/**
 * Make the next occurrence's row agree with its note. `shown` is the
 * text of the row the tap put up, when it put one up. `note` is the
 * note the tick made or kept, or undefined when no note exists.
 */
function placeSuccessor(
  rows: TaskItem[],
  successorId: string,
  shown: string | undefined,
  note: TaskItem | undefined,
): TaskItem[] {
  if (note == null) {
    // A row with no note goes, whatever happened to it since. A row
    // this tap did not put up belongs to a note, so it stays.
    return shown == null ? rows : removeRow(rows, successorId);
  }
  if (shown != null) {
    return settleRow(rows, successorId, shown, note);
  }
  return rowById(rows, successorId) == null ? insertRow(rows, note) : rows;
}

const spec: VaultMutationSpec<ToggleVariables, Toggled, ToggleContext | undefined> = {
  label: "tick",
  optimistic(rows, { id, to, successorId }) {
    const previous = rowById(rows, id);
    if (previous == null) {
      return { rows, context: undefined };
    }
    if (holds(previous, to)) {
      return { rows, context: { previous, text: previous.text } };
    }
    const updated = applyPatch(previous, {
      completed: to === "done" ? nowStamp() : null,
    });
    let next = patchRow(rows, id, () => updated);
    const due = nextDue(previous);
    let successorText: string | undefined;
    // A retry can find the row of the next note its first try kept. It
    // puts up no second row with the same id.
    if (
      successorId != null &&
      due != null &&
      rowById(rows, successorId) == null
    ) {
      const input = spawnInput(previous, due);
      const taken = new Set(rows.map((row) => row.fileName));
      const successor = taskFromText(
        {
          id: successorId,
          uri: successorId,
          fileName: spawnFileName(input.title, due, taken),
          name: input.title,
        },
        spawnContent(input, nowStamp()),
      );
      successorText = successor.text;
      next = insertRow(next, successor);
    }
    return { rows: next, context: { previous, text: updated.text, successorText } };
  },
  async run({ id, to, successorId }, io) {
    const before = await readRow(io.adapter, requireRow(io.rows(), id));
    if (holds(before, to)) {
      // A later tap landed this state. A second tick would make a
      // second next occurrence, so the write does nothing.
      return { before, after: before };
    }
    if (to === "open") {
      return reopen(before, io);
    }
    const after = applyPatch(before, { completed: nowStamp() });
    const due = successorId == null ? null : nextDue(before);
    if (successorId == null || due == null) {
      await io.adapter.write(before.uri, after.text);
      return { before, after };
    }
    const kept = rowById(io.rows(), successorId);
    if (kept != null && !kept.uri.startsWith(PENDING)) {
      // A retry after a SuccessorKeptError. The first try made the next
      // note and could not take it back, so this try keeps that note
      // and only completes this one. A failure here takes back nothing,
      // because this try made nothing.
      await io.adapter.write(before.uri, after.text);
      return { before, after, successor: kept };
    }
    // The next note comes first: a failed create leaves the series as
    // it was. A failed completion takes the new note back, so the worst
    // case is two open occurrences, never a lost series (ADR 0027).
    const input = spawnInput(before, due);
    const taken = new Set(
      io
        .rows()
        .filter((row) => row.id !== successorId)
        .map((row) => row.fileName),
    );
    const created = await createNote(
      io.adapter,
      // The next occurrence sits beside this one.
      io.adapter.parentOf(before.uri),
      spawnFileName(input.title, due, taken),
      spawnContent(input, nowStamp()),
      input.title,
    );
    const successor = taskFromText(
      {
        id: successorId,
        uri: created.uri,
        fileName: created.fileName,
        name: input.title,
      },
      created.text,
    );
    try {
      await io.adapter.write(before.uri, after.text);
    } catch (error) {
      try {
        await io.adapter.remove(created.uri);
      } catch (removal) {
        throw new SuccessorKeptError(error, removal, successor);
      }
      throw error;
    }
    return { before, after, successor };
  },
  settle(rows, { id, successorId }, r, c, last) {
    if (c == null) {
      return rows;
    }
    let next = settleRow(rows, id, c.text, r.after);
    if (last) {
      // A Retry can run while another tap on the row is pending. That
      // tap fails and rolls the row back, so the row no longer holds
      // this write's text. With no write left, the note is the truth.
      next = patchRow(next, id, (row) =>
        row.text === r.after.text
          ? row
          : { ...r.after, id, uri: row.uri, fileName: row.fileName },
      );
    }
    if (successorId != null) {
      next = placeSuccessor(next, successorId, c.successorText, r.successor);
    }
    return r.removed == null ? next : removeRow(next, r.removed.id);
  },
  rollback(rows, { id, successorId }, c, error) {
    if (c == null) {
      return rows;
    }
    let next = rollbackRow(rows, id, c.text, c.previous);
    if (successorId != null) {
      // Only a SuccessorKeptError leaves a next note that this try made.
      next = placeSuccessor(
        next,
        successorId,
        c.successorText,
        error instanceof SuccessorKeptError ? error.successor : undefined,
      );
    }
    return next;
  },
  alarms(r): AlarmMove[] {
    // A toggle that found its state already on disk moved no alarm.
    const moves: AlarmMove[] =
      r.after === r.before ? [] : [[r.before, r.after]];
    if (r.successor != null) {
      moves.push([null, r.successor]);
    }
    if (r.removed != null) {
      moves.push([r.removed, null]);
    }
    return moves;
  },
  errorAlarms(error): AlarmMove[] {
    // The kept note is on disk and open, so it needs its alarm now, not
    // after the next read.
    return error instanceof SuccessorKeptError
      ? [[null, error.successor]]
      : [];
  },
};

/**
 * Reopen an occurrence. Its successor goes too, but only while it still
 * holds the text the tick wrote. An edited or completed one stays,
 * because deleting it would drop the user's work.
 */
async function reopen(
  before: TaskItem,
  io: VaultIo,
): Promise<Toggled> {
  const after = applyPatch(before, { completed: null });
  await io.adapter.write(before.uri, after.text);
  const due = nextDue(before);
  if (due == null) {
    return { before, after };
  }
  const link = `[[${before.fileName.replace(/\.md$/, "")}]]`;
  const spawn = io
    .rows()
    .find(
      (row) =>
        row.data?.["recurrence previous"] === link &&
        !row.uri.startsWith(PENDING),
    );
  if (spawn == null) {
    return { before, after };
  }
  try {
    const fresh = taskFromText(spawn, await io.adapter.read(spawn.uri));
    if (!isUntouchedSpawn(fresh, spawnInput(before, due))) {
      return {
        before,
        after,
        notice: "the next occurrence was edited, so both notes stay",
      };
    }
    await io.adapter.remove(spawn.uri);
    return { before, after, removed: spawn };
  } catch (error) {
    return {
      before,
      after,
      notice: `the next occurrence could not be taken back: ${messageOf(error)}`,
    };
  }
}

/**
 * Tick or untick a task. The direction comes from the row in the cache
 * now, so a second tap in the same frame undoes the first. A recurring
 * tick shows the next occurrence at once. The promise settles when the
 * write does and never rejects: a failure goes to the failure list.
 */
export function useToggleTask(): (task: TaskItem) => Promise<void> {
  const client = useQueryClient();
  const { root } = useVault();
  const { mutateAsync } = useVaultMutation(spec);
  return React.useCallback(
    async (task) => {
      const current = rowById(cachedRows(client, root), task.id) ?? task;
      const to =
        current.data != null && taskIsDone(current.data) ? "open" : "done";
      const successorId =
        to === "done" && nextDue(current) != null ? pendingId() : undefined;
      await mutateAsync({ id: current.id, to, successorId }).catch(
        () => undefined,
      );
    },
    [client, root, mutateAsync],
  );
}
