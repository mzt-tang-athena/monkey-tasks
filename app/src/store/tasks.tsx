import * as React from "react";
import { AppState, Platform } from "react-native";
import { taskIsDone, type TaskFrontmatter } from "@monkey-tasks/schemas";
import { todayIso } from "../lib/dates";
import { loadMockTasks, toggleMockCompleted } from "../lib/mock";
import { getSavedVaultUri, requestVaultAccess } from "../features/vault/grant";
import { ensureSubfolder } from "../features/vault/scan";
import { loadVaultTasks } from "../features/vault/session";
import { createNote, writeNote } from "../features/vault/notes";
import { type TaskItem } from "../features/tasks/query";
import { applyPatch } from "../features/tasks/patch";
import { nextDue } from "../features/tasks/recurrence";
import { syncReminders, syncTaskReminders } from "../features/reminders/sync";
import {
  captureDraft,
  type CaptureTarget,
} from "../features/capture/write";
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
 *
 * Mutations are local first: the row changes in the same frame as the
 * tap, and the note is written behind it. The vault is read again on
 * boot, on refresh, on a new grant, and when the app returns to the
 * foreground, not after every write. See ADR 0017.
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
  /** Drop the last failure once the user has seen it. */
  clearError: () => void;
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

/** A row that exists only in memory until its file lands. */
let pendingSeq = 0;

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = React.useState<TaskItem[]>([]);
  const [tasksDir, setTasksDir] = React.useState<string | null>(null);
  const [rootUri, setRootUri] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<StoreStatus>("loading");
  const [lastError, setLastError] = React.useState<string | null>(null);

  // The list is read synchronously by mutations. A tap computes from
  // this ref, not from the last render, so two quick taps chain even
  // when React has not painted the first one yet.
  const tasksRef = React.useRef<TaskItem[]>(tasks);

  const applyTasks = React.useCallback((next: TaskItem[]) => {
    tasksRef.current = next;
    setTasks(next);
  }, []);

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

  // One queue per note uri. A note is written in order, one write at a
  // time, so two taps cannot interleave read-modify-write cycles.
  const writes = React.useRef(new Map<string, Promise<void>>());

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
        applyTasks(await loadMockTasks());
      } else {
        applyTasks([]);
      }
      setStatus("ready");
      return;
    }
    try {
      const { tasksDir: folder, tasks: loaded } = await loadVaultTasks(root);
      setTasksDir(folder);
      applyTasks(loaded);
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
  }, [rootUri, applyTasks]);

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

  // Another app (Obsidian) can edit a note while this one is in the
  // background. The local list is the truth while the app runs, so a
  // return to the foreground is the moment to let the vault win again.
  // A pending write would be read back stale, so it skips that turn.
  React.useEffect(() => {
    if (!booted) {
      return;
    }
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || writes.current.size > 0) {
        return;
      }
      void load();
    });
    return () => subscription.remove();
  }, [booted, load]);

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

  const value = React.useMemo<TaskStore>(
    () => ({
      mode: rootUri ? "vault" : "mock",
      tasks,
      tasksDir,
      rootUri,
      status,
      lastError,
      clearError,
      grant,
      refresh: () => load(),
      toggle,
      writeFields,
      capture,
    }),
    [tasks, tasksDir, rootUri, status, lastError, clearError, grant, load, toggle, writeFields, capture],
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
