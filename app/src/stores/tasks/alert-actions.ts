import { taskIsDone } from "@monkey-tasks/schemas";
import type { AlertAction } from "@/lib/alerts/actions";
import { actionLabel, buttonAction } from "@/lib/alerts/actions";
import {
  clearActionFailure,
  failureId,
  recordActionFailure,
} from "@/lib/alerts/action-failures";
import { claimPress } from "@/lib/alerts/handled";
import {
  clearActionFailureNotice,
  postActionFailure,
  type AlertResponse,
} from "@/lib/notifications";
import type { VaultAdapter } from "@/lib/vault/adapter";
import type { TaskItem } from "@/types/task";
import {
  acknowledgeRingNow,
  inTurn,
  reconcileTask,
} from "./reminder-sync";
import {
  completeTask,
  messageOf,
  rescheduleTask,
  SuccessorKeptError,
  type ReadTask,
} from "./task-actions";
import { taskFromText } from "./task-notes";

/** One press on a reminder's button. */
export type AlertPress = {
  uri: string;
  /** The alarm minute the pressed ring belongs to. */
  base?: number;
  action: AlertAction;
  /** The task's name, for a failure notice. */
  name: string;
  /** Names the press, so a repeat of it does nothing. */
  key: string;
};

/**
 * The press behind a tap on a button, or null for a tap on the
 * notification itself or a button this build lacks.
 */
export function pressOf(
  response: AlertResponse,
  now: Date = new Date(),
): AlertPress | null {
  if (response.button == null) {
    return null;
  }
  const action = buttonAction(response.button, now);
  return action == null
    ? null
    : {
        uri: response.uri,
        base: response.base,
        action,
        name: response.name,
        key: response.key,
      };
}

/** What a press changed. Absent when the note already held the state. */
export type Applied = {
  before: ReadTask;
  after: TaskItem;
  successor?: TaskItem;
};

/**
 * Read the note a press names, as the list would: file name and all.
 * The folder listing gives the name, and the names taken beside it.
 */
async function readTask(
  adapter: VaultAdapter,
  uri: string,
): Promise<{ task: ReadTask; taken: Set<string> }> {
  const entries = await adapter.list(adapter.parentOf(uri));
  const entry = entries.find((candidate) => candidate.uri === uri);
  if (entry == null) {
    throw new Error("the note is gone");
  }
  const task = taskFromText(
    {
      id: uri,
      uri,
      fileName: entry.name,
      name: entry.name.replace(/\.md$/, ""),
    },
    await adapter.read(uri),
  );
  if (task.data == null) {
    throw new Error(`${entry.name} has no readable frontmatter`);
  }
  return {
    task: { ...task, data: task.data },
    taken: new Set(entries.map((candidate) => candidate.name)),
  };
}

/**
 * Write what a button asks for. A note already done stays as it is, so
 * a second press makes no second next occurrence.
 */
export async function applyAlertAction(
  adapter: VaultAdapter,
  uri: string,
  action: AlertAction,
): Promise<Applied | null> {
  const { task, taken } = await readTask(adapter, uri);
  if (taskIsDone(task.data)) {
    return null;
  }
  if (action.kind === "reschedule") {
    return rescheduleTask(adapter, task, action.target);
  }
  return completeTask(adapter, task, { spawn: true, taken });
}

async function moveAlarms(applied: Applied | null, press: AlertPress) {
  if (press.base != null) {
    // The pressed group leaves the tray and the schedule first, so a
    // moved task never keeps the ring it just answered.
    try {
      await acknowledgeRingNow({ uri: press.uri, base: press.base });
    } catch {
      // The rebuild below clears what this missed.
    }
  }
  if (applied == null) {
    return;
  }
  await reconcileTask(applied.before, applied.after);
  if (applied.successor != null) {
    await reconcileTask(null, applied.successor);
  }
}

/**
 * A press whose write failed. The note is unchanged and the reminder
 * stays in the tray. A notification says so, the app lists it when it
 * opens, and the press can be tried again from there.
 */
async function reportFailure(
  press: AlertPress,
  error: unknown,
): Promise<void> {
  const id = failureId(press.uri, press.action);
  const message = messageOf(error);
  const { name } = press;
  recordActionFailure({
    id,
    uri: press.uri,
    name,
    action: press.action,
    message,
    at: Date.now(),
  });
  if (error instanceof SuccessorKeptError) {
    // The next note is on disk and open, so it needs its alarm now.
    await reconcileTask(null, error.successor);
  }
  try {
    await postActionFailure({
      id,
      title: `${actionLabel(press.action)} did not save`,
      body: `${name}: ${message}`,
      uri: press.uri,
    });
  } catch {
    // The record above still shows in the app.
  }
}

/**
 * Run one press: write the note, then move the alarms, as one turn so
 * two presses never overlap. Never throws: a failure is kept and shown.
 */
export function performAlertPress(
  adapter: VaultAdapter,
  press: AlertPress,
  options: { retry?: boolean } = {},
): Promise<Applied | null> {
  return inTurn(async () => {
    if (!options.retry && !claimPress(press.key)) {
      return null;
    }
    const id = failureId(press.uri, press.action);
    try {
      const applied = await applyAlertAction(adapter, press.uri, press.action);
      clearActionFailure(id);
      await clearActionFailureNotice(id).catch(() => undefined);
      await moveAlarms(applied, press);
      return applied;
    } catch (error) {
      await reportFailure(press, error);
      return null;
    }
  });
}
