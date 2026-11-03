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
import { VAULT_SCOPE } from "./read-gate";
import { useReminderSync } from "./reminder-sync";
import { useCaptureTask } from "./mutations/use-capture-task";
import { useEditTask } from "./mutations/use-edit-task";
import { usePatchTask } from "./mutations/use-patch-task";
import { useToggleTask } from "./mutations/use-toggle-task";
import { messageOf } from "./mutations/use-vault-mutation";
import { useVaultFailures } from "./use-vault-failures";
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
 * a phone, the memory vault in the browser preview and the tests.
 *
 * The list lives in the query cache. The read hydrates it, and each
 * write is a mutation hook under `mutations/` that changes its rows in
 * the same frame as the tap and writes the note behind it. The vault is
 * read on boot, on refresh, on a new grant, and when the app returns to
 * the foreground, never after a write. See ADR 0017.
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
  const { adapter, root: rootUri, booted, grant: requestRoot } = useVault();

  // The granted folder's list. The Tasks folder inside the root is
  // found on every read, so a reload can never read from the wrong
  // place. With no root there is nothing to read.
  const vault = useQuery(tasksQueryOptions(adapter, rootUri, client));

  // A read from disk rebuilds every alarm. A write moves only its own
  // task's alarms.
  useReminderSync();

  const { refetch } = vault;
  const tasks = vault.data?.tasks ?? NO_TASKS;
  const tasksDir = vault.data?.tasksDir ?? null;
  const lists = vault.data?.lists ?? NO_LISTS;
  const broken = vault.data?.broken ?? NO_BROKEN;

  const toggle = useToggleTask();
  const writeFields = usePatchTask();
  const edit = useEditTask();
  const capture = useCaptureTask();
  const failures = useVaultFailures();

  // A grant of the folder already in use leaves the query key as it
  // is, so the store reads it again: the user picked it to get it back.
  const grant = React.useCallback(async () => {
    const uri = await requestRoot();
    if (uri != null && uri === rootUri) {
      await refetch();
    }
  }, [requestRoot, rootUri, refetch]);

  // A refresh reads the granted folder again. With no folder there is
  // nothing to read: refetch() ignores `enabled`, so it is not called.
  const refresh = React.useCallback(async () => {
    if (rootUri == null) {
      return;
    }
    await refetch();
  }, [rootUri, refetch]);

  // Drop every failed write and notice the banner shows.
  const clearError = React.useCallback(() => {
    const cache = client.getMutationCache();
    for (const mutation of cache.findAll({ mutationKey: [VAULT_SCOPE] })) {
      if (mutation.state.status !== "pending") {
        cache.remove(mutation);
      }
    }
  }, [client]);

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

  // The newest failed write, or the read's error.
  const newest = failures.at(-1);
  const lastError =
    newest != null
      ? `${newest.label}: ${newest.message}`
      : vault.error != null
        ? `vault read: ${messageOf(vault.error)}`
        : null;

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
