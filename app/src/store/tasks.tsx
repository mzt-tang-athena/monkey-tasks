import * as React from "react";
import { taskIsDone, type TaskFrontmatter } from "@monkey-tasks/schemas";
import { todayIso } from "../lib/dates";
import { loadMockTasks, toggleMockCompleted } from "../lib/mock";
import { getSavedVaultUri, requestVaultAccess } from "../features/vault/grant";
import { ensureSubfolder } from "../features/vault/scan";
import { loadTasks, type TaskItem } from "../features/tasks/query";
import { setCompleted, setProperty } from "../features/tasks/mutate";
import { writeCapture, type CaptureTarget } from "../features/capture/write";
import type { ParsedCapture } from "../features/capture/parse";

/**
 * The one task store both tabs consume, with two modes:
 *
 * - `vault`: a real folder granted over SAF. Reads hydrate from the
 *   Tasks subfolder, writes (toggles, drag drops,捕获) rewrite the
 *   note files through the mutation helpers.
 * - `mock`: no vault folder yet - the design preview's in-memory
 *   set, which still supports every interaction, including capture
 *   (tasks are appended in place so Enter works in the browser).
 */
export type StoreStatus = "loading" | "ready" | "error";

export type TaskStore = {
  mode: "mock" | "vault";
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

  const grant = React.useCallback(async () => {
    const uri = await requestVaultAccess();
    if (uri) {
      setRootUri(uri);
    }
  }, []);

  const refresh = React.useCallback(
    async (uri?: string) => {
      if (!uri) {
        const loaded = await loadMockTasks();
        setTasks(loaded);
        setStatus("ready");
        return;
      }
      try {
        const folder = await ensureSubfolder(uri, "Tasks");
        const loaded = await loadTasks(folder);
        setTasksDir(folder);
        setTasks(loaded);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    },
    [],
  );

  // Boot once: a saved folder flips the store into vault mode;
  // otherwise the store serves the design-preview mock set. The
  // saved-folder read goes through SAF, unavailable on web: it
  // resolves to null there and the mock store serves the preview.
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
      const uri = saved ?? null;
      setRootUri(uri);
      await refresh(uri ?? undefined);
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const toggle = React.useCallback(
    async (task: TaskItem) => {
      if (!tasksDir) {
        setTasks((current) =>
          current.map((item) =>
            item.uri === task.uri ? toggleMockCompleted(item) : item,
          ),
        );
        return;
      }
      await setCompleted(task, task.data != null && !taskIsDone(task.data));
      await refresh(tasksDir);
    },
    [tasksDir, refresh],
  );

  const writeFields = React.useCallback(
    async (task: TaskItem, patch: Partial<TaskFrontmatter>) => {
      if (!tasksDir) {
        setTasks((current) =>
          current.map((item) =>
            item.uri === task.uri ? patchItem(item, patch) : item,
          ),
        );
        return;
      }
      // Optimistic local apply; the vault note is rewritten behind it.
      setTasks(current =>
        current.map((item) =>
          item.uri === task.uri ? patchItem(item, patch) : item,
        ),
      );
      try {
        for (const [key, value] of Object.entries(patch)) {
          const raw = value as string | string[] | undefined;
          await setProperty(task, key, raw ?? null);
        }
      } catch {
        void refresh(tasksDir);
      }
    },
    [tasksDir, refresh],
  );

  const capture = React.useCallback(
    async (
      parsed: ParsedCapture,
      target: CaptureTarget,
      preselectedDue?: string,
    ) => {
      const due = preselectedDue && !parsed.due ? preselectedDue : parsed.due;
      if (!tasksDir) {
        // Mock mode: append the parsed result to the in-memory set.
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
      await writeCapture(tasksDir, parsed, target, preselectedDue);
      await refresh(tasksDir);
    },
    [tasksDir, refresh],
  );

  const value = React.useMemo<TaskStore>(
    () => ({
      mode: tasksDir ? "vault" : "mock",
      tasks,
      tasksDir,
      rootUri,
      status,
      grant,
      refresh: () => refresh(tasksDir ?? undefined),
      toggle,
      writeFields,
      capture,
    }),
    [tasks, tasksDir, rootUri, status, grant, refresh, toggle, writeFields, capture],
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
