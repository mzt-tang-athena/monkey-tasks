import * as React from "react";
import { Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Toast } from "@/components/ui/toast";
import { TaskEditorContext, type TaskEditorValue } from "@/hooks/use-task-editor";
import { safeFileName } from "@/lib/vault/file-name";
import {
  useDeleteTask,
  type DeletedTask,
} from "@/stores/tasks/mutations/use-delete-task";
import { useEditTask } from "@/stores/tasks/mutations/use-edit-task";
import { useRestoreTask } from "@/stores/tasks/mutations/use-restore-task";
import { useToggleTask } from "@/stores/tasks/mutations/use-toggle-task";
import { useStoreMeta, useTaskList } from "@/stores/tasks/task-state";
import { bottomBar, spacing } from "@/theme/tokens";
import type { TaskEdit } from "@/types/task";
import { EditorSheet } from "./components/editor-sheet";
import { useSheetClock } from "./hooks/use-sheet-clock";
import { draftOf, findTask, isTaskNote } from "./lib/draft";
import {
  EMPTY_EDITOR,
  reduce,
  type EditorEvent,
  type EditorState,
} from "./lib/session";

/**
 * SAF has no rename call: a rename writes the new file, copies the
 * text, and deletes the old one. Obsidian reads that as a delete plus
 * a create, so links to the old name do not follow. The first rename
 * in a session says so once; later ones stay quiet.
 */
let renameWarned = false;

/** React Native Web's Alert is a no-op, so the web gets the browser's. */
function warnRename(): void {
  const message =
    "Obsidian sees a delete and a create, so links to the old name will not follow.";
  if (Platform.OS === "web") {
    globalThis.alert(message);
    return;
  }
  Alert.alert("Rename changes the note file", message, [{ text: "OK" }]);
}

/** How long a toast with an action stays. */
const TOAST_MS = 5000;

type Notice = {
  id: number;
  message: string;
  action?: { label: string; accessibilityLabel: string; run: () => void };
};

/**
 * Hosts the task editor above every screen: one session per open task,
 * one write in flight at a time, delete with Undo, and the toast both
 * report through. A session outlives the sheet, so a close never
 * cancels a write.
 */
export function TaskEditorProvider({ children }: { children: React.ReactNode }) {
  const tasks = useTaskList();
  const { lists } = useStoreMeta();
  const editTask = useEditTask();
  const removeTask = useDeleteTask();
  const restoreTask = useRestoreTask();
  const toggleTask = useToggleTask();
  const insets = useSafeAreaInsets();

  const [state, setState] = React.useState<EditorState>(EMPTY_EDITOR);
  const [notice, setNotice] = React.useState<Notice | null>(null);
  // The write in flight, so a delete or a tick waits for it.
  const inFlight = React.useRef<Promise<void> | null>(null);
  const openId = state.openId;
  const session = openId == null ? null : state.sessions[openId] ?? null;
  const row = openId == null ? null : (findTask(tasks, openId) ?? null);
  const { mounted, progress } = useSheetClock(session != null);

  const notify = React.useCallback((next: Omit<Notice, "id">) => {
    setNotice({ ...next, id: Date.now() });
  }, []);

  React.useEffect(() => {
    if (notice == null) {
      return;
    }
    const timer = setTimeout(() => setNotice(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  // One write per task. Its result lands on the session, which starts
  // the draft that waited behind it.
  const runWrite = React.useCallback(
    async (id: string, edit: TaskEdit, expected: string) => {
      const target = findTask(tasks, id);
      if (target == null) {
        setState((held) =>
          reduce(held, {
            type: "session",
            id,
            event: { type: "failed", message: "the task is no longer here" },
          }).state,
        );
        return;
      }
      // The rename warning follows the file name the write will use,
      // not the display text: only a new file loses the old links.
      if (
        target.data?.title == null &&
        `${safeFileName(edit.name)}.md` !== target.fileName &&
        !renameWarned
      ) {
        renameWarned = true;
        warnRename();
      }
      try {
        const written = await editTask(target, edit, expected);
        setState(
          (held) =>
            reduce(held, {
              type: "session",
              id,
              event: { type: "written", edit, text: written.text },
            }).state,
        );
      } catch (error) {
        setState((held) =>
          reduce(held, {
            type: "session",
            id,
            event: {
              type: "failed",
              message: error instanceof Error ? error.message : String(error),
            },
          }).state,
        );
      }
    },
    [editTask, tasks],
  );

  const apply = React.useCallback(
    (event: EditorEvent) => {
      setState((held) => {
        const result = reduce(held, event);
        if (result.job != null) {
          const { id, job } = result.job;
          const run = runWrite(id, job.edit, job.expected);
          inFlight.current = run;
          void run.finally(() => {
            if (inFlight.current === run) {
              inFlight.current = null;
            }
          });
        }
        return result.state;
      });
    },
    [runWrite],
  );

  const opener = React.useMemo<TaskEditorValue>(
    () => ({
      showing: session != null,
      open: (id) => {
        const target = findTask(tasks, id);
        // The editor writes task frontmatter, so a note that is not a
        // task keeps its read-only screen.
        if (target == null || !isTaskNote(target)) {
          return;
        }
        setNotice(null);
        apply({
          type: "open",
          id: target.id,
          draft: draftOf(target),
          base: target.text,
        });
      },
    }),
    [apply, session, tasks],
  );

  /** Wait for the write in flight, then run the work that follows. */
  const settled = async (): Promise<void> => {
    const run = inFlight.current;
    if (run != null) {
      await run;
    }
  };

  const undo = async (deleted: DeletedTask): Promise<void> => {
    try {
      await restoreTask(deleted);
    } catch {
      notify({ message: "The app could not restore the task." });
    }
  };

  const remove = async (): Promise<void> => {
    if (row == null) {
      return;
    }
    const target = row;
    apply({ type: "drop", id: target.id });
    await settled();
    try {
      const deleted = await removeTask(target);
      notify({
        message: "Task deleted",
        action: {
          label: "Undo",
          accessibilityLabel: "undo delete",
          run: () => void undo(deleted),
        },
      });
    } catch {
      notify({ message: "The task could not be deleted." });
    }
  };

  const tick = async (): Promise<void> => {
    if (row == null) {
      return;
    }
    const target = row;
    apply({ type: "drop", id: target.id });
    await settled();
    await toggleTask(target);
  };

  return (
    <TaskEditorContext.Provider value={opener}>
      {children}
      {mounted && session != null && row != null ? (
        <EditorSheet
          open={session != null}
          progress={progress}
          draft={session.draft}
          today={new Date()}
          lists={lists}
          write={session.write}
          onChange={(patch) => apply({ type: "session", id: row.id, event: { type: "change", patch } })}
          onRetry={() =>
            apply({
              type: "session",
              id: row.id,
              event: { type: "retry", base: row.text },
            })
          }
          onClose={() => apply({ type: "close" })}
          onDelete={() => void remove()}
          onToggle={() => void tick()}
        />
      ) : null}
      {notice == null ? null : (
        <Toast
          message={notice.message}
          tone="info"
          bottom={insets.bottom + bottomBar.row + spacing.s * 2}
          actions={
            notice.action == null
              ? []
              : [
                  {
                    label: notice.action.label,
                    accessibilityLabel: notice.action.accessibilityLabel,
                    onPress: () => {
                      setNotice(null);
                      notice.action?.run();
                    },
                  },
                ]
          }
        />
      )}
    </TaskEditorContext.Provider>
  );
}
