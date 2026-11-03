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
import { tasksQueryOptions } from "./query";
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
      brokenLists: broken,
    }),
    [rootUri, status, readError, tasksDir, listNames, broken],
  );

  return (
    <TaskListContext.Provider value={tasks}>
      <StoreMetaContext.Provider value={meta}>{children}</StoreMetaContext.Provider>
    </TaskListContext.Provider>
  );
}
