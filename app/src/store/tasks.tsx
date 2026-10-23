import * as React from "react";
import { Platform } from "react-native";
import {
  QueryClientContext,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  taskFrontmatter,
  taskIsDone,
  validateNote,
  type TaskFrontmatter,
} from "@monkey-tasks/schemas";
import { todayIso } from "../lib/dates";
import { loadMockTasks, toggleMockCompleted } from "../lib/mock";
import { getSavedVaultUri, requestVaultAccess } from "../features/vault/grant";
import { ensureSubfolder } from "../features/vault/scan";
import { loadVaultTasks } from "../features/vault/session";
import { type ListItem } from "../features/lists/query";
import {
  createNote,
  updateProperty,
  writeNote,
} from "../features/vault/notes";
import { type TaskItem } from "../features/tasks/query";
import { saveTaskEdit, type TaskEdit } from "../features/task-editor/save";
import { applyPatch } from "../features/tasks/patch";
import { nextDue } from "../features/tasks/recurrence";
import { syncReminders, syncTaskReminders } from "../features/reminders/sync";
import {
  captureDraft,
  safeFileName,
  type CaptureTarget,
} from "../features/capture/write";
import type { ParsedCapture } from "../features/capture/parse";
import { makeQueryClient } from "./query-client";
import {
  StoreMetaContext,
  TaskListContext,
  type StoreMeta,
  type StoreStatus,
} from "./task-state";
import { TaskActionsContext, type TaskActions } from "./task-actions";

/**
 * The one task store both tabs consume, with two modes:
 *
 * - `vault`: a real folder granted over SAF. Reads hydrate from the
 *   Tasks subfolder, writes (toggles, drag drops, capture) rewrite the
 *   note files through the mutation helpers.
 * - `mock`: no vault folder yet - the design preview's in-memory
 *   set, which still supports every interaction, including capture
 *   (tasks are appended in place so Enter works in the browser).
 *
 * The list itself lives in the query cache: the read hydrates it, and a
 * mutation writes the optimistic row into it, so every row consumer
 * reads one place. Mutations are local first: the row changes in the
 * same frame as the tap, and the note is written behind it. The vault is
 * read on boot, on refresh, on a new grant, and when the app returns to
 * the foreground, never after a write. See ADR 0017.
 */

/** What the list query caches: the folder the rows came from, the rows,
 * and the list notes that become the extra tabs. */
export type TaskListData = {
  tasksDir: string | null;
  tasks: TaskItem[];
  lists: ListItem[];
};

/** A row that exists only in memory until its file lands. */
let pendingSeq = 0;

/** The empty list, shared so a store with no rows keeps one identity. */
const NO_TASKS: TaskItem[] = [];

/** The empty list-note set, shared for the same reason. */
const NO_LISTS: ListItem[] = [];

/** The frontmatter block that opens a note. */
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

/**
 * Write a list property in the vault's block style. `updateProperty`
 * inserts a one-item array on the key's line when the key is missing,
 * which parses as a scalar rather than a list, so the key is seeded
 * empty first and then filled.
 */
function setBlockList(text: string, key: string, values: string[]): string {
  if (values.length === 0) {
    return updateProperty(text, key, null);
  }
  return updateProperty(updateProperty(text, key, []), key, values);
}

/**
 * Replace everything below the frontmatter block. The fence keeps the
 * newline that separates it from the body, so a body starting with a
 * newline keeps its blank line.
 */
function replaceBody(text: string, body: string): string {
  const match = FRONTMATTER.exec(text);
  if (!match) {
    throw new Error("note has no frontmatter block");
  }
  const fence = match[0];
  if (body === "" || fence.endsWith("\n")) {
    return `${fence}${body}`;
  }
  return `${fence}\n${body}`;
}

/**
 * The editor's save without a file, for the browser preview. The same
 * property writers the vault write runs, so the preview's rows move the
 * way a real note does. A sample row carries no file text, so its
 * frontmatter block is rebuilt from the parsed data first and the
 * writers then have the note they expect.
 */
function editMockTask(item: TaskItem, edit: TaskEdit): TaskItem {
  let text = item.text;
  if (!FRONTMATTER.test(text)) {
    if (item.data == null) {
      throw new Error("note has no frontmatter block");
    }
    text = "---\n\n---\n";
    for (const [key, value] of Object.entries(item.data)) {
      if (typeof value === "string") {
        text = updateProperty(text, key, value);
      } else if (Array.isArray(value)) {
        // The parsed values are storage strings; anything else is not
        // a property this writer can put back.
        text = setBlockList(
          text,
          key,
          value.filter((entry): entry is string => typeof entry === "string"),
        );
      }
    }
  }
  text = updateProperty(text, "due", edit.due);
  text = updateProperty(text, "recurrence", edit.recurrence);
  text = setBlockList(text, "reminders", edit.reminders);
  text = setBlockList(
    text,
    "lists",
    edit.lists.map((name) => `[[${name}]]`),
  );
  text = replaceBody(text, edit.body);

  // No provider renames the file, so the row takes the name the editor
  // asked for; the uri stays the row's identity.
  const fileName = `${safeFileName(edit.name)}.md`;
  const note = validateNote(fileName, text, taskFrontmatter);
  return {
    id: item.id,
    uri: item.uri,
    fileName,
    name: edit.name,
    text,
    data: note.data,
    body: note.note.body,
  };
}

export function TasksProvider({ children }: { children: React.ReactNode }) {
  // The app mounts one client above the store; a tree that mounts the
  // store on its own (a test, a preview) gets one of its own rather
  // than reading rows from a client nobody provided.
  const inherited = React.useContext(QueryClientContext);
  if (inherited != null) {
    return <TaskStore>{children}</TaskStore>;
  }
  return <OwnedTaskStore>{children}</OwnedTaskStore>;
}

function OwnedTaskStore({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <TaskStore>{children}</TaskStore>
    </QueryClientProvider>
  );
}

function TaskStore({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [rootUri, setRootUri] = React.useState<string | null>(null);
  const [booted, setBooted] = React.useState(false);
  const [lastError, setLastError] = React.useState<string | null>(null);

  // The list is read synchronously by mutations. A tap computes from
  // this ref, not from the last render, so two quick taps chain even
  // when React has not painted the first one yet.
  const tasksRef = React.useRef<TaskItem[]>(NO_TASKS);

  // One queue per note uri. A note is written in order, one write at a
  // time, so two taps cannot interleave read-modify-write cycles.
  const writes = React.useRef(new Map<string, Promise<void>>());

  // A read waits for the notes still being written: a reload during a
  // write would read the old text back over the row the user just
  // changed. The wait replaces the old "skip this turn" check.
  const readVault = React.useCallback(
    async (root: string): Promise<TaskListData> => {
      await Promise.all(
        [...writes.current.values()].map((write) =>
          write.catch(() => undefined),
        ),
      );
      const loaded = await loadVaultTasks(root);
      // A folder that reads is a folder that works again: the banner
      // should not outlive the failure it reported.
      setLastError(null);
      return loaded;
    },
    [],
  );

  // The granted folder's list. The root is the folder the user picked;
  // the Tasks folder inside it is derived on every load, so a reload can
  // never read from the wrong place.
  const vault = useQuery({
    queryKey: ["tasks", rootUri],
    queryFn: () => readVault(rootUri as string),
    enabled: rootUri != null,
    // A cache entry never goes stale on its own, so focus must ask for
    // the read rather than wait for a staleness check to allow it: the
    // return to the foreground is when the vault wins over the local
    // list.
    refetchOnWindowFocus: "always",
  });

  // The browser has no folder picker, so with no root it serves the
  // sample set. A device shows an empty list and asks for a folder,
  // because writing to a mock list on a phone looks like a working app
  // that loses every edit.
  const mock = useQuery({
    queryKey: ["mock"],
    queryFn: async (): Promise<TaskListData> => ({
      tasksDir: null,
      tasks: await loadMockTasks(),
      lists: NO_LISTS,
    }),
    enabled: rootUri == null && Platform.OS === "web",
    refetchOnWindowFocus: "always",
  });

  const active = rootUri != null ? vault : mock;
  const { refetch } = active;
  const tasks = active.data?.tasks ?? NO_TASKS;
  const tasksDir = active.data?.tasksDir ?? null;
  const lists = active.data?.lists ?? NO_LISTS;

  // The cache entry a write lands in: the granted folder's list, or the
  // sample set standing in for it.
  const activeKey = React.useMemo(
    () => (rootUri != null ? ["tasks", rootUri] : ["mock"]),
    [rootUri],
  );

  const applyTasks = React.useCallback(
    (next: TaskItem[]) => {
      tasksRef.current = next;
      // The cache is the list. The optimistic row goes through it, so a
      // consumer re-renders from the same place a reload would land.
      queryClient.setQueryData<TaskListData>(activeKey, (old) => ({
        tasksDir: old?.tasksDir ?? null,
        tasks: next,
        lists: old?.lists ?? NO_LISTS,
      }));
    },
    [queryClient, activeKey],
  );

  // A fetch fills the cache directly, so the ref follows the rows it
  // renders, not only the rows a mutation writes.
  React.useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const patchOne = React.useCallback(
    (uri: string, change: (item: TaskItem) => TaskItem): TaskItem | null => {
      const next = tasksRef.current.map((item) =>
        item.uri === uri ? change(item) : item,
      );
      applyTasks(next);
      return next.find((item) => item.uri === uri) ?? null;
    },
    [applyTasks],
  );

  const queueWrite = React.useCallback((uri: string, text: string) => {
    const previous = writes.current.get(uri) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => writeNote(uri, text));
    writes.current.set(uri, next);
    const settle = () => {
      if (writes.current.get(uri) === next) {
        writes.current.delete(uri);
      }
    };
    void next.then(settle, settle);
    return next;
  }, []);

  // A failure the screen can shrug off: the message is cleared by the
  // banner's dismiss, not by the next render.
  const clearError = React.useCallback(() => {
    setLastError(null);
  }, []);

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

  // Boot once: read the saved folder (SAF on Android; the read is
  // unavailable on web, so it resolves to null and the mock store
  // serves the design preview). The queries then follow rootUri, which
  // is also how a fresh grant flips the store into vault mode.
  React.useEffect(() => {
    let live = true;
    void (async () => {
      let saved: string | null = null;
      try {
        saved = await getSavedVaultUri();
      } catch {
        saved = null;
      }
      if (!live) {
        return;
      }
      setRootUri(saved ?? null);
      setBooted(true);
    })();
    return () => {
      live = false;
    };
  }, []);

  // A read failure is reported where a write failure is: the banner.
  const readError = active.error;
  React.useEffect(() => {
    if (readError == null) {
      return;
    }
    // The message lands after the fetch has settled, never during a
    // render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastError(`vault read: ${String(readError)}`);
  }, [readError]);

  const status: StoreStatus = React.useMemo(() => {
    if (!booted) {
      return "loading";
    }
    // No root on a device is a settled empty store, not a pending read:
    // there is nothing to load until a folder is granted.
    if (rootUri == null && Platform.OS !== "web") {
      return "ready";
    }
    if (active.isError) {
      return "error";
    }
    if (active.isPending) {
      return "loading";
    }
    return "ready";
  }, [booted, rootUri, active.isError, active.isPending]);

  // The alarm list is rebuilt from the notes just read, so a capture, a
  // tick or a drag all leave the schedule matching the list. Fire and
  // forget: notifications must never hold up the store.
  const loaded = vault.data;
  React.useEffect(() => {
    if (loaded == null) {
      return;
    }
    void syncReminders(loaded.tasks).catch(() => undefined);
  }, [loaded]);

  const toggle = React.useCallback(
    async (task: TaskItem) => {
      if (!rootUri) {
        if (Platform.OS !== "web") {
          setLastError("connect a vault folder before ticking a task");
          return;
        }
        applyTasks(
          tasksRef.current.map((item) =>
            item.uri === task.uri ? toggleMockCompleted(item) : item,
          ),
        );
        return;
      }
      if (!tasksDir) {
        setLastError("toggle: the vault folder is not ready yet");
        return;
      }
      // Read the freshest row: a second tap in the same frame must build
      // on the first, not on the row this render captured.
      const current =
        tasksRef.current.find((item) => item.uri === task.uri) ?? task;
      // A capture that is still writing has no file yet. The tap is
      // dropped, not reported: the row becomes real in a moment.
      if (current.uri.startsWith("pending://")) {
        return;
      }
      if (current.data == null) {
        setLastError("toggle: the note has no readable frontmatter");
        return;
      }
      const ticking = !taskIsDone(current.data);
      const recurrence = current.data.recurrence;
      // Ticking a recurring task never finishes it: the tick moves the
      // due date, and the reminder that rides with it, forward. A rule
      // with no future occurrence falls through to completion.
      const next =
        ticking && recurrence
          ? nextDue(recurrence, current.data.due, new Date())
          : null;
      const updated = applyPatch(
        current,
        next != null
          ? {
              due: next,
              // A date-only due carries no time of day, so no alarm.
              reminders: next.includes("T") ? [next] : null,
            }
          : { completed: ticking ? todayIso() : null },
      );

      patchOne(current.uri, () => updated);
      try {
        await queueWrite(current.uri, updated.text);
        setLastError(null);
      } catch (error) {
        // Roll back only when no later tap has moved the note on; that
        // tap owns the row now and its write reports its own failure.
        patchOne(current.uri, (item) =>
          item.text === updated.text ? current : item,
        );
        setLastError(`toggle write: ${String(error)}`);
        return;
      }
      void syncTaskReminders(current, updated);
    },
    [rootUri, tasksDir, applyTasks, patchOne, queueWrite],
  );

  const writeFields = React.useCallback(
    async (task: TaskItem, patch: Partial<TaskFrontmatter>) => {
      if (!rootUri) {
        if (Platform.OS !== "web") {
          setLastError("connect a vault folder before editing a task");
          return;
        }
        patchOne(task.uri, (item) => applyPatch(item, patch));
        return;
      }
      if (!tasksDir) {
        setLastError("field write: the vault folder is not ready yet");
        return;
      }
      const current =
        tasksRef.current.find((item) => item.uri === task.uri) ?? task;
      if (current.uri.startsWith("pending://")) {
        return;
      }
      const updated = applyPatch(current, patch);
      if (updated.text === current.text) {
        return;
      }
      patchOne(current.uri, () => updated);
      try {
        await queueWrite(current.uri, updated.text);
        setLastError(null);
      } catch (error) {
        patchOne(current.uri, (item) =>
          item.text === updated.text ? current : item,
        );
        setLastError(`field write: ${String(error)}`);
        return;
      }
      void syncTaskReminders(current, updated);
    },
    [rootUri, tasksDir, patchOne, queueWrite],
  );

  const edit = React.useCallback(
    async (task: TaskItem, change: TaskEdit) => {
      const current =
        tasksRef.current.find((item) => item.id === task.id) ?? task;
      try {
        if (rootUri == null && Platform.OS === "web") {
          // Browser preview: the row is the note, so the draft lands in
          // memory. No file to write and no alarm to schedule.
          const updated = editMockTask(current, change);
          applyTasks(
            tasksRef.current.map((item) =>
              item.id === current.id ? updated : item,
            ),
          );
          setLastError(null);
          return;
        }
        const updated = await saveTaskEdit(current, change);
        // A rename changes the uri, so the row is found by its render
        // identity. The cache keeps its list tabs: only the rows move.
        applyTasks(
          tasksRef.current.map((item) =>
            item.id === current.id ? updated : item,
          ),
        );
        setLastError(null);
        if (current.uri === updated.uri) {
          void syncTaskReminders(current, updated);
        } else {
          // The alarm ids are keyed by uri, so a renamed note drops its
          // old alarms before the new uri schedules its own.
          void syncTaskReminders(current, null).then(() =>
            syncTaskReminders(null, updated),
          );
        }
      } catch (error) {
        setLastError(`task edit: ${String(error)}`);
        // The editor keeps its draft and shows the refusal, so the
        // failure has to reach the caller as well as the banner.
        throw error;
      }
    },
    [rootUri, applyTasks],
  );

  const capture = React.useCallback(
    async (
      parsed: ParsedCapture,
      target: CaptureTarget,
      preselectedDue?: string,
    ) => {
      const due = preselectedDue && !parsed.due ? preselectedDue : parsed.due;
      const draft = captureDraft(parsed, target, due);
      if (!rootUri) {
        if (Platform.OS !== "web") {
          const message = "capture: connect a vault folder first";
          setLastError(message);
          throw new Error(message);
        }
        // Web preview: append the parsed result to the in-memory set.
        const mockUri = `mock://vault/Tasks/${draft.fileName}`;
        applyTasks([
          ...tasksRef.current,
          {
            id: mockUri,
            uri: mockUri,
            fileName: draft.fileName,
            name: draft.name,
            text: draft.content,
            data: draft.data,
            body: "",
          },
        ]);
        return;
      }

      const provisional = `pending://${(pendingSeq += 1)}`;
      const item: TaskItem = {
        // The row's identity is the provisional string, and it stays
        // that way once the file lands: only the uri changes, so the
        // row never remounts under the closing sheet.
        id: provisional,
        uri: provisional,
        fileName: draft.fileName,
        name: draft.name,
        text: draft.content,
        data: draft.data,
        body: "",
      };
      try {
        // The row appears before the folder lookup and the file do; both
        // follow it.
        applyTasks([...tasksRef.current, item]);
        // The Tasks folder is derived from the root, so a capture still
        // lands in the right place when the first load failed.
        const folder = tasksDir ?? (await ensureSubfolder(rootUri, "Tasks"));
        const uri = await createNote(folder, draft.fileName, draft.content);
        patchOne(provisional, (row) => ({ ...row, uri }));
        setLastError(null);
        void syncTaskReminders(null, { ...item, uri });
      } catch (error) {
        applyTasks(tasksRef.current.filter((row) => row.uri !== provisional));
        const message = `capture write: ${String(error)}`;
        setLastError(message);
        // The promise rejects so the bar can offer the same capture
        // again from its toast; the failed row is gone from the list.
        throw new Error(message);
      }
    },
    [rootUri, tasksDir, applyTasks, patchOne],
  );

  // A refresh is a refetch of the list the store is showing: the vault
  // when a folder is granted, the sample set on the browser.
  const refresh = React.useCallback(async () => {
    await refetch();
  }, [refetch]);

  const listNames = React.useMemo(
    () => lists.map((item) => item.name),
    [lists],
  );

  const meta = React.useMemo<StoreMeta>(
    () => ({
      mode: rootUri ? "vault" : "mock",
      status,
      lastError,
      tasksDir,
      rootUri,
      lists: listNames,
    }),
    [rootUri, status, lastError, tasksDir, listNames],
  );

  // The actions never read a row, so their identity holds across task
  // changes; a row consumer re-renders on a tick, a callback holder
  // does not.
  const actions = React.useMemo<TaskActions>(
    () => ({
      clearError,
      grant,
      refresh,
      toggle,
      writeFields,
      edit,
      capture,
    }),
    [clearError, grant, refresh, toggle, writeFields, edit, capture],
  );

  return (
    <TaskListContext.Provider value={tasks}>
      <StoreMetaContext.Provider value={meta}>
        <TaskActionsContext.Provider value={actions}>
          {children}
        </TaskActionsContext.Provider>
      </StoreMetaContext.Provider>
    </TaskListContext.Provider>
  );
}
