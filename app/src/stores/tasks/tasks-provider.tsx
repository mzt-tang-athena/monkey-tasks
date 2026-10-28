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
import { nowStamp, todayIso } from "@/utils/dates";
import {
  loadMockTasks,
  mockBroken,
  mockLists,
  toggleMockCompleted,
} from "@/lib/mock";
import { getSavedVaultUri, requestVaultAccess } from "@/lib/vault/grant";
import { ensureSubfolder } from "@/lib/vault/scan";
import { loadVaultTasks } from "./load-vault";
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
  deleteNote,
  readNote,
  writeNote,
  writeNoteIfUnchanged,
} from "@/lib/vault/notes";
import {
  frontmatterSpan,
  replaceBody,
  setBlockList,
  updateProperty,
} from "@/lib/vault/frontmatter";
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
import { safeFileName } from "@/lib/vault/file-name";
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

/**
 * The editor's save without a file, for the browser preview. The same
 * property writers the vault write runs, so the preview's rows move the
 * way a real note does. A sample row carries no file text, so its
 * frontmatter block is rebuilt from the parsed data first and the
 * writers then have the note they expect.
 */
function editMockTask(item: TaskItem, edit: TaskEdit): TaskItem {
  let text = item.text;
  if (frontmatterSpan(text) == null) {
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
        const loaded = await loadVaultTasks(root);
        if (writeSeq.current === seq) {
          // A folder that reads is a folder that works again: the
          // banner should not outlive the failure it reported.
          setLastError(null);
          return loaded;
        }
      }
      const loaded = await loadVaultTasks(root);
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
      lists: mockLists,
      broken: mockBroken,
    }),
    enabled: rootUri == null && Platform.OS === "web",
    refetchOnWindowFocus: "always",
  });

  const active = rootUri != null ? vault : mock;
  const { refetch } = active;
  const tasks = active.data?.tasks ?? NO_TASKS;
  const tasksDir = active.data?.tasksDir ?? null;
  const lists = active.data?.lists ?? NO_LISTS;
  const broken = active.data?.broken ?? NO_BROKEN;

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
      queueWork(uri, () => writeNoteIfUnchanged(uri, expected, text)),
    [queueWork],
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
          await writeNoteIfUnchanged(base.uri, base.text, first.text);
          return first;
        } catch (error) {
          if (!(error instanceof NoteChangedError)) {
            throw error;
          }
          const fresh = await readNote(base.uri);
          // The file may hold an edit we never saw: parse it, then add
          // this patch on top, so the row and the note agree.
          const retried = applyPatch(taskFromText(base, fresh), patch);
          await writeNote(base.uri, retried.text);
          return retried;
        }
      }),
    [queueWork],
  );

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

  /**
   * Complete a recurring occurrence and create its successor. The
   * create comes first: a failed create leaves the series intact. A
   * failed completion deletes the new note, so the worst case is two
   * open occurrences, never a lost series.
   */
  const spawnNext = React.useCallback(
    async (current: TaskItem, next: string) => {
      const data = current.data;
      if (data == null || tasksDir == null) {
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
        created = await createNote(tasksDir, fileName, text, input.title);
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
        await deleteNote(created.uri).catch(() => undefined);
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
    [tasksDir, applyTasks, patchOne, queueWrite],
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
          await deleteNote(spawn.uri);
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
    [applyTasks, patchOne, queueWrite],
  );

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
    [
      rootUri,
      tasksDir,
      applyTasks,
      patchOne,
      queuePatch,
      spawnNext,
      reopenOccurrence,
    ],
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
    [rootUri, tasksDir, patchOne, queuePatch],
  );

  const edit = React.useCallback(
    async (task: TaskItem, change: TaskEdit, expected?: string) => {
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
        const updated = await queueWork(current.uri, () =>
          saveTaskEdit(current, change, expected ?? current.text),
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
    [rootUri, applyTasks, queueWork],
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
        const created = await createNote(
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
