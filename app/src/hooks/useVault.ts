import * as React from "react";
import { getSavedVaultUri, requestVaultAccess } from "../features/vault/grant";
import { ensureSubfolder } from "../features/vault/scan";
import { loadTasks, type TaskItem } from "../features/tasks/query";

/**
 * Vault session state: the granted root, the Tasks folder, and the
 * task list. Both tabs consume this one hook.
 */
export function useVault() {
  const [rootUri, setRootUri] = React.useState<string | null>(null);
  const [tasksDir, setTasksDir] = React.useState<string | null>(null);
  const [tasks, setTasks] = React.useState<TaskItem[]>([]);
  const [status, setStatus] = React.useState("No vault folder granted yet.");

  const grant = React.useCallback(async () => {
    const uri = await requestVaultAccess();
    if (!uri) {
      setStatus("Folder permission denied.");
      return;
    }
    setRootUri(uri);
  }, []);

  const refresh = React.useCallback(async () => {
    if (!rootUri) {
      return;
    }
    try {
      const tasksFolder = await ensureSubfolder(rootUri, "Tasks");
      setTasksDir(tasksFolder);
      const loaded = await loadTasks(tasksFolder);
      setTasks(loaded);
      setStatus(`${loaded.length} tasks`);
    } catch (error) {
      setStatus(`Vault read failed: ${String(error)}`);
    }
  }, [rootUri]);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      const saved = await getSavedVaultUri();
      if (active && saved) {
        setRootUri(saved);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      if (!rootUri) {
        return;
      }
      try {
        const tasksFolder = await ensureSubfolder(rootUri, "Tasks");
        const loaded = await loadTasks(tasksFolder);
        if (!active) {
          return;
        }
        setTasksDir(tasksFolder);
        setTasks(loaded);
        setStatus(`${loaded.length} tasks`);
      } catch (error) {
        if (active) {
          setStatus(`Vault read failed: ${String(error)}`);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [rootUri]);

  return { rootUri, tasksDir, tasks, status, grant, refresh };
}
