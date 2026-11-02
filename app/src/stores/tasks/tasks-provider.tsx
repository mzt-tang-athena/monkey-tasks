import * as React from "react";
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
import { nowStamp, todayIso } from "@/utils/dates";
import { useVault } from "@/lib/vault/vault-provider";
import { ensureTasksFolder, loadVault } from "./load-vault";
import type {
  BrokenList,
  CaptureTarget,
  ListItem,
  ParsedCapture,
  TaskEdit,
  TaskItem,
} from "@/types/task";
import {
  NoteChangedError,
  createNote,
  writeNoteIfUnchanged,
} from "@/lib/vault/notes";
// eslint-disable-next-line import/no-restricted-paths -- 0052 moves this
import { saveTaskEdit } from "@/features/task-editor/save";
import { applyPatch } from "./patch";
import { nextAfter } from "@/lib/recurrence";
import {
  isUntouchedSpawn,
  spawnContent,
  spawnFileName,
  type SpawnInput,
} from "./spawn";
import { syncReminders, syncTaskReminders } from "./reminder-sync";
// eslint-disable-next-line import/no-restricted-paths -- 0052 moves this
import { captureDraft } from "@/features/capture/write";
import { taskFromText } from "./task-notes";
import { makeQueryClient } from "@/lib/react-query";
import {
  StoreMetaContext,
  TaskListContext,
  type StoreMeta,
  type StoreStatus,
} from "./task-state";
import { TaskActionsContext, type TaskActions } from "./task-actions";

/**
 * The one task store both tabs consume. Every read and write goes
 * through the vault adapter (ADR 0037): the granted folder over SAF on
 * a phone, the memory vault in the browser preview and the tests. The
 * store has one code path for both. Reads hydrate from the Tasks
 * subfolder, and writes (toggles, drag drops, capture, the editor)
 * rewrite the note files.
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
  /** Notes in Lists/ that fail validation: shown, never dropped. */
  broken: BrokenList[];
};

/** A row that exists only in memory until its file lands. */
let pendingSeq = 0;

/** The empty list, shared so a store with no rows keeps one identity. */
const NO_TASKS: TaskItem[] = [];

/** The empty list-note set, shared for the same reason. */
const NO_LISTS: ListItem[] = [];

/** The empty broken-note set, shared for the same reason. */
const NO_BROKEN: BrokenList[] = [];

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
  const { adapter, root: rootUri, booted, grant: requestRoot } = useVault();
  const [lastError, setLastError] = React.useState<string | null>(null);

  // The list is read synchronously by mutations. A tap computes from
  // this ref, not from the last render, so two quick taps chain even
  // when React has not painted the first one yet.
  const tasksRef = React.useRef<TaskItem[]>(NO_TASKS);

  // One queue per note uri. A note is written in order, one write at a
  // time, so two taps cannot interleave read-modify-write cycles.
  const writes = React.useRef(new Map<string, Promise<void>>());

  // Bumped whenever a write is queued. A read that overlapped a write
  // cannot trust its result: the file may have changed under it.
  const writeSeq = React.useRef(0);

  // A read waits for the notes still being written, and re-reads when
  // a write was queued while it ran. Without the second check a
  // foreground refresh could land its old text over a row the user
  // just saved.
  const readVault = React.useCallback(
    async (root: string): Promise<TaskListData> => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const seq = writeSeq.current;
        await Promise.all(
          [...writes.current.values()].map((write) =>
            write.catch(() => undefined),
          ),
        );
        const loaded = await loadVault(adapter, root);
        if (writeSeq.current === seq) {
          // A folder that reads is a folder that works again: the
          // banner should not outlive the failure it reported.
          setLastError(null);
          return loaded;
        }
      }
      const loaded = await loadVault(adapter, root);
      setLastError(null);
      return loaded;
    },
    [adapter],
  );

  // The granted folder's list. The root is the folder the user picked;
  // the Tasks folder inside it is derived on every load, so a reload can
  // never read from the wrong place. With no root there is nothing to
  // read, and the store is an empty list.
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

  const { refetch } = vault;
  const tasks = vault.data?.tasks ?? NO_TASKS;
  const tasksDir = vault.data?.tasksDir ?? null;
  const lists = vault.data?.lists ?? NO_LISTS;
  const broken = vault.data?.broken ?? NO_BROKEN;

  // The cache entry a write lands in.
  const activeKey = React.useMemo(() => ["tasks", rootUri], [rootUri]);

  const applyTasks = React.useCallback(
    (next: TaskItem[]) => {
      tasksRef.current = next;
      // The cache is the list. The optimistic row goes through it, so a
      // consumer re-renders from the same place a reload would land.
      queryClient.setQueryData<TaskListData>(activeKey, (old) => ({
        tasksDir: old?.tasksDir ?? null,
        tasks: next,
        lists: old?.lists ?? NO_LISTS,
        broken: old?.broken ?? NO_BROKEN,
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

  // The queue serialises writes per note. Each write also carries the
  // text it was built from, so a write that lost a race to another
  // writer refuses instead of dropping that change.
  // Run one piece of work after the note's previous work. The queue
  // covers the editor's whole read-modify-write, not only its last
  // write, so a refresh cannot read the note in the middle of a save.
  const queueWork = React.useCallback(
    <T,>(uri: string, run: () => Promise<T>): Promise<T> => {
      writeSeq.current += 1;
      const previous = writes.current.get(uri) ?? Promise.resolve();
      const next = previous.catch(() => undefined).then(run);
      const settled = next.then(
        () => undefined,
        () => undefined,
      );
      writes.current.set(uri, settled);
      const settle = () => {
        if (writes.current.get(uri) === settled) {
          writes.current.delete(uri);
        }
      };
      void settled.then(settle);
      return next;
    },
    [],
  );

  const queueWrite = React.useCallback(
    (uri: string, expected: string, text: string) =>
      queueWork(uri, () => writeNoteIfUnchanged(adapter, uri, expected, text)),
    [adapter, queueWork],
  );

  /**
   * Apply a frontmatter patch to a note, even when the note moved on
   * since this row was read. A tap that raced an earlier write of the
   * same note would otherwise fail with a conflict and roll back, so
   * the work re-reads the file and applies the same patch to what is
   * there. The queue owns the note while it runs.
   */
  const queuePatch = React.useCallback(
    (base: TaskItem, patch: Partial<TaskFrontmatter>): Promise<TaskItem> =>
      queueWork(base.uri, async () => {
        const first = applyPatch(base, patch);
        try {
          await writeNoteIfUnchanged(adapter, base.uri, base.text, first.text);
          return first;
        } catch (error) {
          if (!(error instanceof NoteChangedError)) {
            throw error;
          }
          const fresh = await adapter.read(base.uri);
          // The file may hold an edit we never saw: parse it, then add
          // this patch on top, so the row and the note agree.
          const retried = applyPatch(taskFromText(base, fresh), patch);
          await adapter.write(base.uri, retried.text);
          return retried;
        }
      }),
    [adapter, queueWork],
  );

  // A failure the screen can shrug off: the message is cleared by the
  // banner's dismiss, not by the next render.
  const clearError = React.useCallback(() => {
    setLastError(null);
  }, []);

  // A grant of the folder already in use leaves the query key as it
  // is, so the store reads it again: the user picked it to get it back.
  const grant = React.useCallback(async () => {
    const uri = await requestRoot();
    if (uri != null && uri === rootUri) {
      await refetch();
    }
  }, [requestRoot, rootUri, refetch]);

  // A read failure is reported where a write failure is: the banner.
  const readError = vault.error;
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
    // No root is a settled empty store, not a pending read: there is
    // nothing to load until a folder is granted.
    if (rootUri == null) {
      return "ready";
    }
    if (vault.isError) {
      return "error";
    }
    if (vault.isPending) {
      return "loading";
    }
    return "ready";
  }, [booted, rootUri, vault.isError, vault.isPending]);

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

  /**
   * Complete a recurring occurrence and create its successor. The
   * create comes first: a failed create leaves the series intact. A
   * failed completion deletes the new note, so the worst case is two
   * open occurrences, never a lost series.
   */
  const spawnNext = React.useCallback(
    async (current: TaskItem, next: string) => {
      const data = current.data;
      if (data == null) {
        return;
      }
      const title = data.title ?? current.name;
      const previous = current.fileName.replace(/\.md$/, "");
      const input: SpawnInput = {
        title,
        previous,
        due: next,
        recurrence: data.recurrence ?? "",
        lists: data.lists ?? [],
        // A date-only due carries no time of day, so no alarm.
        reminders: next.includes("T") ? [next] : [],
        body: current.body,
      };
      const taken = new Set(tasksRef.current.map((item) => item.fileName));
      const fileName = spawnFileName(title, next, taken);
      const text = spawnContent(input, nowStamp());
      let created: Awaited<ReturnType<typeof createNote>>;
      try {
        // The next occurrence sits beside this one (ADR 0027).
        created = await createNote(
          adapter,
          adapter.parentOf(current.uri),
          fileName,
          text,
          input.title,
        );
      } catch (error) {
        setLastError(`recurring create: ${String(error)}`);
        return;
      }
      const note = validateNote(created.fileName, created.text, taskFrontmatter);
      const spawn: TaskItem = {
        id: created.uri,
        uri: created.uri,
        fileName: created.fileName,
        name: note.data?.title ?? created.fileName.replace(/\.md$/, ""),
        text: created.text,
        data: note.data,
        body: note.note.body,
      };
      applyTasks([...tasksRef.current, spawn]);

      const completed = applyPatch(current, { completed: todayIso() });
      try {
        await queueWrite(current.uri, current.text, completed.text);
      } catch (error) {
        // Compensation: take the new note back, keep the old one open.
        await adapter.remove(created.uri).catch(() => undefined);
        applyTasks(
          tasksRef.current.filter((item) => item.uri !== created.uri),
        );
        setLastError(`recurring complete: ${String(error)}`);
        return;
      }
      patchOne(current.uri, () => completed);
      setLastError(null);
      void syncTaskReminders(current, null).then(() =>
        syncTaskReminders(null, spawn),
      );
    },
    [adapter, applyTasks, patchOne, queueWrite],
  );

  /**
   * Reopen a completed occurrence. The successor goes first only when
   * it still holds the text we wrote; an edited or completed one stays,
   * because deleting it would drop the user's work.
   */
  const reopenOccurrence = React.useCallback(
    async (current: TaskItem) => {
      const data = current.data;
      if (data == null) {
        return;
      }
      const previous = `[[${current.fileName.replace(/\.md$/, "")}]]`;
      const spawn = tasksRef.current.find(
        (item) => item.data?.["recurrence previous"] === previous,
      );
      const updated = applyPatch(current, { completed: null });
      try {
        await queueWrite(current.uri, current.text, updated.text);
      } catch (error) {
        setLastError(`toggle write: ${String(error)}`);
        return;
      }
      patchOne(current.uri, () => updated);
      void syncTaskReminders(current, updated);

      if (spawn == null) {
        setLastError(null);
        return;
      }
      const next = nextAfter(data.recurrence ?? "", data.due);
      const expected: SpawnInput | null =
        next == null
          ? null
          : {
              title: data.title ?? current.name,
              previous: current.fileName.replace(/\.md$/, ""),
              due: next,
              recurrence: data.recurrence ?? "",
              lists: data.lists ?? [],
              reminders: next.includes("T") ? [next] : [],
              body: current.body,
            };
      if (expected != null && isUntouchedSpawn(spawn, expected)) {
        try {
          await adapter.remove(spawn.uri);
          applyTasks(tasksRef.current.filter((item) => item.uri !== spawn.uri));
          setLastError(null);
          void syncTaskReminders(spawn, null);
        } catch (error) {
          setLastError(`recurring delete: ${String(error)}`);
        }
      } else {
        setLastError(
          "recurring: the next occurrence was edited, so both notes stay",
        );
      }
    },
    [adapter, applyTasks, patchOne, queueWrite],
  );

  const toggle = React.useCallback(
    async (task: TaskItem) => {
      if (rootUri == null) {
        setLastError("connect a vault folder before ticking a task");
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
      // Ticking a recurring task completes the occurrence and creates
      // the next one as its own note (ADR 0027). A rule with no next
      // date falls through to a plain completion. Unticking reopens the
      // occurrence and takes back an untouched successor.
      if (recurrence) {
        const next = nextAfter(recurrence, current.data.due);
        if (ticking && next != null) {
          await spawnNext(current, next);
          return;
        }
        if (!ticking) {
          await reopenOccurrence(current);
          return;
        }
      }
      const updated = applyPatch(current, {
        completed: ticking ? todayIso() : null,
      });

      patchOne(current.uri, () => updated);
      try {
        const written = await queuePatch(current, {
          completed: ticking ? todayIso() : null,
        });
        patchOne(current.uri, () => written);
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
    [rootUri, patchOne, queuePatch, spawnNext, reopenOccurrence],
  );

  const writeFields = React.useCallback(
    async (task: TaskItem, patch: Partial<TaskFrontmatter>) => {
      if (rootUri == null) {
        setLastError("connect a vault folder before editing a task");
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
        const written = await queuePatch(current, patch);
        patchOne(current.uri, () => written);
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
    [rootUri, patchOne, queuePatch],
  );

  const edit = React.useCallback(
    async (task: TaskItem, change: TaskEdit, expected?: string) => {
      const current =
        tasksRef.current.find((item) => item.id === task.id) ?? task;
      try {
        const updated = await queueWork(current.uri, () =>
          saveTaskEdit(adapter, current, change, expected ?? current.text),
        );
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
    [adapter, applyTasks, queueWork],
  );

  const capture = React.useCallback(
    async (
      parsed: ParsedCapture,
      target: CaptureTarget,
      preselectedDue?: string,
    ) => {
      const due = preselectedDue && !parsed.due ? preselectedDue : parsed.due;
      const draft = captureDraft(parsed, target, due);
      if (rootUri == null) {
        const message = "capture: connect a vault folder first";
        setLastError(message);
        throw new Error(message);
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
        // lands in the right place when the first load failed. A vault
        // with no Tasks folder gets one with its first note.
        const folder = tasksDir ?? (await ensureTasksFolder(adapter, rootUri));
        if (tasksDir == null) {
          queryClient.setQueryData<TaskListData>(activeKey, (old) =>
            old == null ? old : { ...old, tasksDir: folder },
          );
        }
        const created = await createNote(
          adapter,
          folder,
          draft.fileName,
          draft.content,
          draft.name,
        );
        // The provider may have added " (1)" to the name. The note
        // then carries the typed name as its title, and the row reads
        // the file that really landed so the next write compares
        // against the right text.
        const note = validateNote(
          created.fileName,
          created.text,
          taskFrontmatter,
        );
        patchOne(provisional, (row) => ({
          ...row,
          uri: created.uri,
          fileName: created.fileName,
          text: created.text,
          data: note.data,
          body: note.note.body,
        }));
        setLastError(null);
        void syncTaskReminders(null, {
          ...item,
          uri: created.uri,
          fileName: created.fileName,
          text: created.text,
        });
      } catch (error) {
        applyTasks(tasksRef.current.filter((row) => row.uri !== provisional));
        const message = `capture write: ${String(error)}`;
        setLastError(message);
        // The promise rejects so the bar can offer the same capture
        // again from its toast; the failed row is gone from the list.
        throw new Error(message);
      }
    },
    [
      adapter,
      queryClient,
      activeKey,
      rootUri,
      tasksDir,
      applyTasks,
      patchOne,
    ],
  );

  // A refresh reads the granted folder again. With no folder there is
  // nothing to read: refetch() ignores `enabled`, so it is not called.
  const refresh = React.useCallback(async () => {
    if (rootUri == null) {
      return;
    }
    await refetch();
  }, [rootUri, refetch]);

  const listNames = React.useMemo(
    () => lists.map((item) => item.name),
    [lists],
  );

  const meta = React.useMemo<StoreMeta>(
    () => ({
      status,
      lastError,
      tasksDir,
      rootUri,
      lists: listNames,
      brokenLists: broken,
    }),
    [rootUri, status, lastError, tasksDir, listNames, broken],
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
