import * as React from "react";
import { Platform } from "react-native";
import { taskIsDone, type TaskFrontmatter } from "@monkey-tasks/schemas";
import { todayIso } from "../lib/dates";
import { loadMockTasks, toggleMockCompleted } from "../lib/mock";
import { getSavedVaultUri, requestVaultAccess } from "../features/vault/grant";
import { ensureSubfolder } from "../features/vault/scan";
import { loadVaultTasks } from "../features/vault/session";
import { type TaskItem } from "../features/tasks/query";
import { setCompleted, setProperties } from "../features/tasks/mutate";
import { nextDue } from "../features/tasks/recurrence";
import { syncReminders } from "../features/reminders/sync";
import { writeCapture, type CaptureTarget } from "../features/capture/write";
import type { ParsedCapture } from "../features/capture/parse";

/**
 * The one task store both tabs consume, with two modes:
 *
 * - `vault`: a real folder granted over SAF. Reads hydrate from the
 *   Tasks subfolder, writes (toggles, drag drops, capture) rewrite the
 *   note files through the mutation helpers.
 * - `mock`: no vault folder yet - the design preview's in-memory
 *   set, which still supports every interaction, including capture
 *   (tasks are appended in place so Enter works in the browser).
 */
export type StoreStatus = "loading" | "ready" | "error";

export type TaskStore = {
  mode: "mock" | "vault";
  /** The last failed operation's text, for diagnostics. */
  lastError: string | null;
  tasks: TaskItem[];
  tasksDir: string | null;
  rootUri: string | null;
  status: StoreStatus;
  grant: () => Promise<void>;
  refresh: () => Promise<void>;
  toggle: (task: TaskItem) => Promise<void>;
  writeFields: (
    task: TaskItem,
    patch: Partial<TaskFrontmatter>,
  ) => Promise<void>;
  capture: (
    parsed: ParsedCapture,
    target: CaptureTarget,
    preselectedDue?: string,
  ) => Promise<void>;
};

const Context = React.createContext<TaskStore | null>(null);

function patchItem(
  task: TaskItem,
  patch: Partial<TaskFrontmatter>,
): TaskItem {
  return {
    ...task,
    data: { ...(task.data as TaskFrontmatter), ...patch },
  };
}

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = React.useState<TaskItem[]>([]);
  const [tasksDir, setTasksDir] = React.useState<string | null>(null);
  const [rootUri, setRootUri] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<StoreStatus>("loading");
  const [lastError, setLastError] = React.useState<string | null>(null);

  const grant = React.useCallback(async () => {
    let uri: string | null = null;
    try {
      uri = await requestVaultAccess();
    } catch {
      uri = null;
    }
    if (uri) {
      setRootUri(uri);
    }
  }, []);

  /**
   * Load the task list for the granted root. The root is the folder
   * the user picked; the Tasks folder inside it is derived on every
   * load, so a reload can never read from the wrong place.
   *
   * With no root there is no vault. The browser has no folder picker,
   * so web serves the sample set; a device shows an empty list and
   * asks for a folder, because writing to a mock list on a phone looks
   * like a working app that loses every edit.
   */
  const load = React.useCallback(async () => {
    const root = rootUri;
    if (!root) {
      setTasksDir(null);
      if (Platform.OS === "web") {
        setTasks(await loadMockTasks());
      } else {
        setTasks([]);
      }
      setStatus("ready");
      return;
    }
    try {
      const { tasksDir: folder, tasks: loaded } = await loadVaultTasks(root);
      setTasksDir(folder);
      setTasks(loaded);
      setStatus("ready");
      setLastError(null);
      // The alarm list is rebuilt from the notes just read, so a capture,
      // a tick or a drag all leave the schedule matching the vault. Fire
      // and forget: notifications must never hold up the store.
      void syncReminders(loaded).catch(() => undefined);
    } catch (error) {
      setStatus("error");
      setLastError(`vault read: ${String(error)}`);
    }
  }, [rootUri]);

  // Boot once: read the saved folder (SAF on Android; the read is
  // unavailable on web, so it resolves to null and the mock store
  // serves the design preview). Loads then follow rootUri, which is
  // also how a fresh grant flips the store into vault mode.
  const [booted, setBooted] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    void (async () => {
      let saved: string | null = null;
      try {
        saved = await getSavedVaultUri();
      } catch {
        saved = null;
      }
      if (!active) {
        return;
      }
      setRootUri(saved ?? null);
      setBooted(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!booted) {
      return;
    }
    // The store's boot load: state changes land after the awaited
    // reads, never synchronously within this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [booted, rootUri, load]);

  const toggle = React.useCallback(
    async (task: TaskItem) => {
      if (!rootUri) {
        if (Platform.OS !== "web") {
          setLastError("connect a vault folder before ticking a task");
          return;
        }
        setTasks((current) =>
          current.map((item) =>
            item.uri === task.uri ? toggleMockCompleted(item) : item,
          ),
        );
        return;
      }
      if (!tasksDir) {
        setLastError("toggle: the vault folder is not ready yet");
        return;
      }
      try {
        const ticking = task.data != null && !taskIsDone(task.data);
        const recurrence = task.data?.recurrence;
        // Ticking a recurring task never finishes it: the tick moves the
        // due date, and the reminder that rides with it, forward. A rule
        // with no future occurrence falls through to completion.
        const next =
          ticking && recurrence
            ? nextDue(recurrence, task.data?.due, new Date())
            : null;
        if (next != null) {
          await setProperties(task, {
            due: next,
            // A date-only due carries no time of day, so no alarm.
            reminders: next.includes("T") ? [next] : null,
          });
        } else {
          await setCompleted(task, ticking);
        }
        await load();
        setLastError(null);
      } catch (error) {
        setLastError(`toggle write: ${String(error)}`);
      }
    },
    [rootUri, tasksDir, load],
  );

  const writeFields = React.useCallback(
    async (task: TaskItem, patch: Partial<TaskFrontmatter>) => {
      if (!rootUri) {
        if (Platform.OS !== "web") {
          setLastError("connect a vault folder before editing a task");
          return;
        }
        setTasks((current) =>
          current.map((item) =>
            item.uri === task.uri ? patchItem(item, patch) : item,
          ),
        );
        return;
      }
      if (!tasksDir) {
        setLastError("field write: the vault folder is not ready yet");
        return;
      }
      // Optimistic local apply; the vault note is rewritten behind it.
      setTasks(current =>
        current.map((item) =>
          item.uri === task.uri ? patchItem(item, patch) : item,
        ),
      );
      try {
        await setProperties(task, patch);
        await load();
        setLastError(null);
      } catch (error) {
        setLastError(`field write: ${String(error)}`);
        void load();
      }
    },
    [rootUri, tasksDir, load],
  );

  const capture = React.useCallback(
    async (
      parsed: ParsedCapture,
      target: CaptureTarget,
      preselectedDue?: string,
    ) => {
      const due = preselectedDue && !parsed.due ? preselectedDue : parsed.due;
      if (!rootUri) {
        if (Platform.OS !== "web") {
          const message = "capture: connect a vault folder first";
          setLastError(message);
          throw new Error(message);
        }
        // Web preview: append the parsed result to the in-memory set.
        setTasks(current => [
          ...current,
          {
            uri: `mock://vault/Tasks/${parsed.name}.md`,
            fileName: `${parsed.name}.md`,
            name: parsed.name,
            text: "",
            data: {
              kind: "[[tasks]]",
              created: todayIso(),
              ...(due ? { due } : {}),
              ...(target.kind === "list"
                ? { lists: [`[[${target.name}]]`] }
                : {}),
              ...(parsed.reminders != null
                ? { reminders: parsed.reminders }
                : {}),
              ...(parsed.recurrence != null
                ? { recurrence: parsed.recurrence }
                : {}),
            },
            body: "",
          },
        ]);
        return;
      }
      try {
        // The Tasks folder is derived from the root, so a capture still
        // lands in the right place when the first load failed.
        const folder = tasksDir ?? (await ensureSubfolder(rootUri, "Tasks"));
        await writeCapture(folder, parsed, target, preselectedDue);
        // The reload reschedules the alarms, so a captured reminder is
        // armed without a second pass here.
        await load();
        setLastError(null);
      } catch (error) {
        const message = `capture write: ${String(error)}`;
        setLastError(message);
        // The sheet keeps the draft and shows the reason.
        throw new Error(message);
      }
    },
    [rootUri, tasksDir, load],
  );

  const value = React.useMemo<TaskStore>(
    () => ({
      mode: rootUri ? "vault" : "mock",
      tasks,
      tasksDir,
      rootUri,
      status,
      lastError,
      grant,
      refresh: () => load(),
      toggle,
      writeFields,
      capture,
    }),
    [tasks, tasksDir, rootUri, status, lastError, grant, load, toggle, writeFields, capture],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useTasks(): TaskStore {
  const store = React.useContext(Context);
  if (store == null) {
    throw new Error("useTasks must run inside TasksProvider");
  }
  return store;
}
