import { useCaptureTask } from "@/stores/tasks/mutations/use-capture-task";
import { useEditTask } from "@/stores/tasks/mutations/use-edit-task";
import { usePatchTask } from "@/stores/tasks/mutations/use-patch-task";
import { useReorderSection } from "@/stores/tasks/mutations/use-reorder-section";
import { useToggleTask } from "@/stores/tasks/mutations/use-toggle-task";
import {
  useStoreMeta,
  useTaskList,
  type StoreMeta,
} from "@/stores/tasks/task-state";
import {
  useVaultFailures,
  type VaultFailure,
} from "@/stores/tasks/use-vault-failures";
import { useGrantFolder, useRefreshTasks } from "@/stores/tasks/use-vault-read";
import type { TaskItem } from "@/types/task";

/** The store as one screen sees it: rows, meta, writes and failures. */
export type StoreSnapshot = StoreMeta & {
  tasks: TaskItem[];
  toggle: ReturnType<typeof useToggleTask>;
  patch: ReturnType<typeof usePatchTask>;
  reorder: ReturnType<typeof useReorderSection>;
  capture: ReturnType<typeof useCaptureTask>;
  edit: ReturnType<typeof useEditTask>;
  refresh: ReturnType<typeof useRefreshTasks>;
  grant: ReturnType<typeof useGrantFolder>;
  failures: VaultFailure[];
};

/**
 * Every store hook a screen calls, read in one place. A store test's
 * probe component renders this under the providers and keeps the
 * result, so the test drives the store the way a screen does.
 */
export function useStoreSnapshot(): StoreSnapshot {
  return {
    ...useStoreMeta(),
    tasks: useTaskList(),
    toggle: useToggleTask(),
    patch: usePatchTask(),
    reorder: useReorderSection(),
    capture: useCaptureTask(),
    edit: useEditTask(),
    refresh: useRefreshTasks(),
    grant: useGrantFolder(),
    failures: useVaultFailures(),
  };
}
