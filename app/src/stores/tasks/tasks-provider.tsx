import * as React from "react";
import {
  QueryClientContext,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useVault } from "@/lib/vault/vault-provider";
import { makeQueryClient } from "@/lib/react-query";
import type { BrokenList, ListItem, TaskItem } from "@/types/task";
import { tasksKey, tasksQueryOptions, type TaskListData } from "./query";
import { clearCachedRows, readCachedRows, type CachedRows } from "./row-cache";
import { useReminderSync } from "./reminder-sync";
import { messageOf } from "./mutations/use-vault-mutation";
import {
  StoreMetaContext,
  TaskListContext,
  type StoreMeta,
  type StoreStatus,
} from "./task-state";

/**
 * The one task store both tabs consume. Every read and write goes
 * through the vault adapter (ADR 0037): the granted folder over SAF on
 * a phone, the memory vault in the browser preview and the tests.
 *
 * The list lives in the query cache. The read hydrates it. Each write
 * is a mutation hook under `mutations/`, which a screen calls directly:
 * it changes its rows in the same frame as the tap and writes the note
 * behind it. The vault is read on boot, on refresh, on a new grant, and
 * when the app returns to the foreground, never after a write. See ADR
 * 0017.
 */

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
  const client = useQueryClient();
  const { adapter, root: rootUri, booted } = useVault();

  // The granted folder's list. The Tasks folder inside the root is
  // found on every read, so a reload can never read from the wrong
  // place. With no root there is nothing to read.
  const vault = useQuery(tasksQueryOptions(adapter, rootUri, client));

  // A read from disk rebuilds every alarm. A write moves only its own
  // task's alarms.
  useReminderSync();

  // Last session's rows, read once from app storage. They seed the
  // query under the granted root so the first frame draws rows instead
  // of the skeleton, and the read that follows always replaces them
  // (ADR 20261126-a-cached-first-frame).
  const [cached] = React.useState<CachedRows | null>(readCachedRows);
  const seeded = React.useRef<{ root: string; rows: TaskListData } | null>(null);
  // Each reason to drop the file runs once, not on every render.
  const dropped = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!booted || rootUri == null || cached == null) {
      return;
    }
    // The rows name the folder they came from. A different grant drops
    // them rather than drawing rows from a vault that is not this one.
    if (cached.root !== rootUri) {
      if (dropped.current !== cached.root) {
        dropped.current = cached.root;
        clearCachedRows();
      }
      return;
    }
    if (seeded.current?.root === rootUri || vault.data != null) {
      return;
    }
    const rows: TaskListData = {
      tasksDir: cached.tasksDir,
      tasks: cached.tasks,
      lists: cached.lists,
      broken: cached.brokenLists,
    };
    seeded.current = { root: rootUri, rows };
    client.setQueryData(tasksKey(rootUri), rows, { updatedAt: 0 });
  }, [booted, rootUri, cached, client, vault.data]);

  // When the read names a different Tasks folder, the vault moved and
  // the rows are from the old one.
  React.useEffect(() => {
    if (cached == null || vault.data == null) {
      return;
    }
    const moved = `${cached.root}>${vault.data.tasksDir ?? ""}`;
    if (vault.data.tasksDir !== cached.tasksDir && dropped.current !== moved) {
      dropped.current = moved;
      clearCachedRows();
    }
  }, [cached, vault.data]);

  // The rows on screen came from the cache until a read stamps them.
  // Only the seed carries no update time, and a read always does, so
  // the seed's copy counts as stale and a read's never does.
  const stale = vault.data != null && vault.dataUpdatedAt === 0;

  const tasks = vault.data?.tasks ?? NO_TASKS;
  const tasksDir = vault.data?.tasksDir ?? null;
  const lists = vault.data?.lists ?? NO_LISTS;
  const broken = vault.data?.broken ?? NO_BROKEN;

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

  const readError =
    vault.error == null ? null : `vault read: ${messageOf(vault.error)}`;

  const listNames = React.useMemo(
    () => lists.map((item) => item.name),
    [lists],
  );

  const meta = React.useMemo<StoreMeta>(
    () => ({
      status,
      readError,
      tasksDir,
      rootUri,
      lists: listNames,
      listNotes: lists,
      brokenLists: broken,
      stale,
      cachedTab: stale ? (cached?.tab ?? null) : null,
    }),
    [rootUri, status, readError, tasksDir, listNames, lists, broken, stale, cached],
  );

  return (
    <TaskListContext.Provider value={tasks}>
      <StoreMetaContext.Provider value={meta}>{children}</StoreMetaContext.Provider>
    </TaskListContext.Provider>
  );
}
