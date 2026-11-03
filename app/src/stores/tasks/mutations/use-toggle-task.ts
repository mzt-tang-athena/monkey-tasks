import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { taskIsDone } from "@monkey-tasks/schemas";
import { nextAfter } from "@/lib/recurrence";
import { createNote } from "@/lib/vault/notes";
import { useVault } from "@/lib/vault/vault-provider";
import { nowStamp, todayIso } from "@/utils/dates";
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
  /** The opposite of what the row showed when it was tapped. */
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
    recurrence: data?.recurrence ?? "",
    lists: data?.lists ?? [],
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

const spec: VaultMutationSpec<ToggleVariables, Toggled, ToggleContext | undefined> = {
  label: "tick",
  optimistic(rows, { id, to, successorId }) {
    const previous = rowById(rows, id);
    if (previous == null) {
      return { rows, context: undefined };
    }
    const updated = applyPatch(previous, {
      completed: to === "done" ? todayIso() : null,
    });
    let next = patchRow(rows, id, () => updated);
    const due = nextDue(previous);
    let successorText: string | undefined;
    if (successorId != null && due != null) {
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
    if (to === "open") {
      return reopen(before, io);
    }
    const after = applyPatch(before, { completed: todayIso() });
    const due = successorId == null ? null : nextDue(before);
    if (successorId == null || due == null) {
      await io.adapter.write(before.uri, after.text);
      return { before, after };
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
  settle(rows, { id, successorId }, r, c) {
    if (c == null) {
      return rows;
    }
    let next = settleRow(rows, id, c.text, r.after);
    if (successorId != null) {
      next =
        r.successor != null && c.successorText != null
          ? settleRow(next, successorId, c.successorText, r.successor)
          : removeRow(next, successorId);
    }
    return r.removed == null ? next : removeRow(next, r.removed.id);
  },
  rollback(rows, { id, successorId }, c, error) {
    if (c == null) {
      return rows;
    }
    let next = rollbackRow(rows, id, c.text, c.previous);
    if (successorId != null) {
      // A successor whose note was never made, or was taken back, has
      // no file, so its row goes whatever happened to it since.
      next =
        error instanceof SuccessorKeptError && c.successorText != null
          ? settleRow(next, successorId, c.successorText, error.successor)
          : removeRow(next, successorId);
    }
    return next;
  },
  alarms(r): AlarmMove[] {
    const moves: AlarmMove[] = [[r.before, r.after]];
    if (r.successor != null) {
      moves.push([null, r.successor]);
    }
    if (r.removed != null) {
      moves.push([r.removed, null]);
    }
    return moves;
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
